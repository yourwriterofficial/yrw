import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/forumServer';
import { daysLeft, effectiveTier, PLANS } from '@/lib/plans';
import { formatMoney } from '@/lib/forums';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';
import { runPrune } from '@/lib/pruneSites';

export const maxDuration = 60;

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const expectedSecret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${expectedSecret || ''}`);
  const given = Buffer.from(authHeader);
  // Fails closed when CRON_SECRET is not set, and compares in constant time.
  if (!expectedSecret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const todayUtc = now.toISOString().slice(0, 10);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const isSunday = now.getUTCDay() === 0;

  const stats = {
    summariesSent: 0,
    cartRemindersSent: 0,
    reviewInvitesSent: 0,
    bookingRemindersSent: 0,
    backupsSent: 0,
    expiryNoticesSent: 0,
  };

  try {
    const { data: sites } = await supabaseAdmin
      .from('forums')
      .select('id, slug, name, owner_id, currency, site_mode, plan_tier')
      .neq('site_mode', 'forum');

    const siteMap = new Map((sites || []).map((s) => [s.id as string, s]));
    const ownerEmailCache = new Map<string, string>();
    const getOwnerEmail = async (ownerId: string) => {
      if (ownerEmailCache.has(ownerId)) return ownerEmailCache.get(ownerId)!;
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(ownerId);
        const email = data?.user?.email || '';
        ownerEmailCache.set(ownerId, email);
        return email;
      } catch {
        return '';
      }
    };

    // Read extended settings tolerantly per column batch
    const { data: extSites, error: extErr } = await supabaseAdmin
      .from('forums')
      .select('id, plan_expires_at, summary_email, last_summary_sent_date, weekly_backup_email, last_backup_sent_date, plan_reminded_stage');

    const extMap = new Map<string, Record<string, unknown>>();
    if (!extErr && extSites) {
      for (const row of extSites as Record<string, unknown>[]) extMap.set(row.id as string, row);
    }

    // 1. Daily summary, weekly JSON backup (4.7), and plan expiry notice (4.11)
    for (const site of sites || []) {
      const ext = extMap.get(site.id as string) || {};
      const planExpires = (ext.plan_expires_at as string | null | undefined) ?? null;
      const tier = effectiveTier(site.plan_tier as string, planExpires);
      const plan = PLANS[tier];

      // 4.11 Expiry notices at 7 days and 1 day left
      if ((site.plan_tier as string) !== 'free' && planExpires) {
        const left = daysLeft(planExpires);
        const reminderTag = left === 7 ? '7d' : left === 1 ? '1d' : null;
        if (reminderTag && ext.plan_reminded_stage !== reminderTag) {
          const email = await getOwnerEmail(site.owner_id as string);
          if (email) {
            const renewUrl = `${siteUrl()}/developer/manage?slug=${encodeURIComponent(site.slug as string)}&tab=plan`;
            const ok = await sendSystemEmail({
              to: email,
              subject: `${site.name}: your ${plan.name} plan ends in ${left === 1 ? '1 day' : '7 days'}`,
              html: emailShell(
                `<h2>Plan renewal reminder</h2><p>Your <strong>${esc(plan.name)}</strong> plan for <strong>${esc(site.name)}</strong> expires in ${left === 1 ? '1 day' : '7 days'} (${new Date(planExpires).toLocaleDateString('en-GB')}).</p><p>Renew early so your Pro tools and custom domain stay active.</p>`,
                'Manage plan',
                renewUrl,
                'developa'
              ),
            }).catch(() => false);
            if (ok) {
              stats.expiryNoticesSent++;
              await supabaseAdmin
                .from('forums')
                .update({ plan_reminded_stage: reminderTag })
                .eq('id', site.id);
            }
          }
        }
      }

      // 2.11 Daily summary
      if (plan.lowStockAlerts && ext.summary_email !== false && ext.last_summary_sent_date !== todayUtc) {
        const [recentOrdersRes, pendingProofRes, prodsRes] = await Promise.all([
          supabaseAdmin
            .from('site_orders')
            .select('total_amount, payment_status')
            .eq('site_id', site.id)
            .gte('created_at', twentyFourHoursAgo),
          supabaseAdmin
            .from('site_orders')
            .select('id', { count: 'exact', head: true })
            .eq('site_id', site.id)
            .eq('payment_status', 'proof_submitted'),
          supabaseAdmin
            .from('site_products')
            .select('id, title, stock_qty, low_stock_at')
            .eq('site_id', site.id)
            .eq('is_active', true),
        ]);
        const recentOrders = recentOrdersRes.data || [];
        const pendingProofs = pendingProofRes.count || 0;
        const lowProds = (!prodsRes.error ? prodsRes.data || [] : []).filter(
          (p) => p.stock_qty !== null && Number(p.stock_qty) <= Number((p as { low_stock_at?: number }).low_stock_at ?? 3)
        );

        if (recentOrders.length > 0 || pendingProofs > 0 || lowProds.length > 0) {
          const ownerEmail = await getOwnerEmail(site.owner_id as string);
          if (ownerEmail) {
            const paidRev = recentOrders
              .filter((o) => o.payment_status === 'paid')
              .reduce((s, o) => s + Number(o.total_amount), 0);
            const cur = (site.currency as string) || 'NGN';
            const lowList = lowProds.length
              ? `<p><strong>Low stock items:</strong></p><ul>${lowProds.map((p) => `<li>${esc(p.title)} — ${esc(p.stock_qty)} left</li>`).join('')}</ul>`
              : '';
            const manageHref = `${siteUrl()}/developer/manage?slug=${encodeURIComponent(site.slug as string)}`;
            const sent = await sendSystemEmail({
              to: ownerEmail,
              subject: `${site.name}: daily store summary (${todayUtc})`,
              html: emailShell(
                `<h2>Daily summary for ${esc(site.name)}</h2><p>Last 24h orders: <strong>${recentOrders.length}</strong> (${esc(formatMoney(paidRev, cur))} paid)</p><p>Payments waiting for check: <strong>${pendingProofs}</strong></p>${lowList}`,
                'Open dashboard',
                manageHref,
                'developa'
              ),
            }).catch(() => false);
            if (sent) {
              stats.summariesSent++;
              await supabaseAdmin.from('forums').update({ last_summary_sent_date: todayUtc }).eq('id', site.id);
            }
          }
        }
      }

      // 4.7 Weekly JSON backup email (Sundays)
      if (isSunday && plan.scheduledBackup && ext.weekly_backup_email === true && ext.last_backup_sent_date !== todayUtc) {
        const ownerEmail = await getOwnerEmail(site.owner_id as string);
        if (ownerEmail) {
          const [prods, orders, coupons] = await Promise.all([
            supabaseAdmin.from('site_products').select('*').eq('site_id', site.id),
            supabaseAdmin.from('site_orders').select('*').eq('site_id', site.id),
            supabaseAdmin.from('site_coupons').select('*').eq('site_id', site.id),
          ]);
          const jsonStr = JSON.stringify({
            exported_at: now.toISOString(),
            site,
            products: prods.data || [],
            orders: orders.data || [],
            coupons: coupons.data || [],
          });
          if (Buffer.byteLength(jsonStr, 'utf8') < 2 * 1024 * 1024) {
            const ok = await sendSystemEmail({
              to: ownerEmail,
              subject: `${site.name}: weekly store backup (${todayUtc})`,
              html: emailShell(
                `<h2>Weekly backup ready</h2><p>Your JSON backup for <strong>${esc(site.name)}</strong> is attached.</p>`,
                'Open store settings',
                `${siteUrl()}/developer/manage?slug=${encodeURIComponent(site.slug as string)}&tab=settings`,
                'developa'
              ),
              attachments: [{ filename: `${site.slug}-backup-${todayUtc}.json`, content: Buffer.from(jsonStr, 'utf8') }],
            }).catch(() => false);
            if (ok) {
              stats.backupsSent++;
              await supabaseAdmin.from('forums').update({ last_backup_sent_date: todayUtc }).eq('id', site.id);
            }
          }
        }
      }
    }

    // 2.12 Abandoned cart 1h & 24h reminders (max 2)
    const { data: openCarts, error: cartErr } = await supabaseAdmin
      .from('site_carts')
      .select('id, site_id, email, buyer_name, items, total, reminder_count, updated_at, reminded_at, unsubscribe_token')
      .eq('status', 'open')
      .lt('reminder_count', 2)
      .neq('email', '')
      .limit(100);

    if (!cartErr && openCarts) {
      for (const c of openCarts) {
        const site = siteMap.get(c.site_id);
        if (!site) continue;
        const ext = extMap.get(c.site_id) || {};
        const tier = effectiveTier(site.plan_tier as string, ext.plan_expires_at as string | null);
        if (!PLANS[tier].abandonedCarts) continue;

        const dueFirst = c.reminder_count === 0 && c.updated_at <= oneHourAgo;
        const dueSecond = c.reminder_count === 1 && c.reminded_at && c.reminded_at <= twentyFourHoursAgo;
        if (!dueFirst && !dueSecond) continue;

        const items = Array.isArray(c.items) ? (c.items as { title: string; qty: number }[]) : [];
        const itemsHtml = items.map((i) => `<li>${esc(i.qty)} × ${esc(i.title)}</li>`).join('');
        const storeHref = `${siteUrl()}/forums/${site.slug}`;
        const unsubHref = `${siteUrl()}/api/forums/${encodeURIComponent(site.slug as string)}/carts/unsubscribe?token=${encodeURIComponent(c.unsubscribe_token)}`;
        const ok = await sendSystemEmail({
          to: c.email,
          subject: `${site.name}: you left items in your cart`,
          html: emailShell(
            `<h2>Still thinking it over?</h2><p>Hi ${esc((c.buyer_name || 'there').split(' ')[0])}, you saved these items at <strong>${esc(site.name)}</strong>:</p><ul>${itemsHtml}</ul><p style="font-size:12px;color:#71717a;margin-top:16px">Don&apos;t want reminders? <a href="${esc(unsubHref)}">Unsubscribe</a></p>`,
            'Return to store',
            storeHref,
            'developa'
          ),
        }).catch(() => false);
        if (ok) {
          stats.cartRemindersSent++;
          await supabaseAdmin
            .from('site_carts')
            .update({ reminder_count: c.reminder_count + 1, reminded_at: now.toISOString() })
            .eq('id', c.id);
        }
      }
    }

    // 2.5 Review invite 3 days after completion (Pro+)
    const { data: reviewOrders, error: revOrdErr } = await supabaseAdmin
      .from('site_orders')
      .select('id, site_id, order_code, buyer_name, buyer_email')
      .eq('payment_status', 'paid')
      .eq('fulfillment_status', 'completed')
      .is('review_reminded_at', null)
      .lte('updated_at', threeDaysAgo)
      .limit(50);

    if (!revOrdErr && reviewOrders) {
      for (const ord of reviewOrders) {
        const site = siteMap.get(ord.site_id);
        if (!site) continue;
        const ext = extMap.get(ord.site_id) || {};
        const tier = effectiveTier(site.plan_tier as string, ext.plan_expires_at as string | null);
        if (!PLANS[tier].reviews) continue;

        const reviewHref = `${siteUrl()}/forums/${site.slug}?order=${encodeURIComponent(ord.order_code)}`;
        const ok = await sendSystemEmail({
          to: ord.buyer_email,
          subject: `How was your order from ${site.name}?`,
          html: emailShell(
            `<h2>Leave a quick review</h2><p>Hi ${esc((ord.buyer_name || '').split(' ')[0] || 'there')}, thank you for shopping with <strong>${esc(site.name)}</strong>. Open order <strong>${esc(ord.order_code)}</strong> to share a rating.</p>`,
            'Rate your items',
            reviewHref,
            'developa'
          ),
        }).catch(() => false);
        if (ok) {
          stats.reviewInvitesSent++;
          await supabaseAdmin
            .from('site_orders')
            .update({ review_reminded_at: now.toISOString() })
            .eq('id', ord.id);
        }
      }
    }

    // 2.6 Booking reminders 24 hours before confirmed slots
    const tomorrowUtc = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: upcomingBookings, error: bookErr } = await supabaseAdmin
      .from('site_bookings')
      .select('id, site_id, service_id, buyer_name, buyer_email, slot_date, slot_time')
      .eq('status', 'confirmed')
      .eq('slot_date', tomorrowUtc)
      .is('reminded_at', null)
      .limit(80);

    if (!bookErr && upcomingBookings && upcomingBookings.length > 0) {
      const svcIds = Array.from(new Set(upcomingBookings.map((b) => b.service_id)));
      const { data: svcRows } = await supabaseAdmin
        .from('site_booking_services')
        .select('id, title')
        .in('id', svcIds);
      const svcTitleMap = new Map((svcRows || []).map((sv) => [sv.id as string, sv.title as string]));

      for (const b of upcomingBookings) {
        const site = siteMap.get(b.site_id);
        if (!site) continue;
        const serviceTitle = svcTitleMap.get(b.service_id) || 'your appointment';
        const storeHref = `${siteUrl()}/forums/${site.slug}`;
        const ok = await sendSystemEmail({
          to: b.buyer_email,
          subject: `Reminder: ${serviceTitle} at ${site.name} tomorrow (${b.slot_time})`,
          html: emailShell(
            `<h2>Appointment reminder</h2><p>Hi ${esc((b.buyer_name || '').split(' ')[0] || 'there')}, this is a quick reminder for <strong>${esc(serviceTitle)}</strong> at <strong>${esc(site.name)}</strong> on <strong>${esc(b.slot_date)}</strong> at <strong>${esc(b.slot_time)}</strong>.</p>`,
            'View store',
            storeHref,
            'developa'
          ),
        }).catch(() => false);
        if (ok) {
          stats.bookingRemindersSent++;
          await supabaseAdmin
            .from('site_bookings')
            .update({ reminded_at: now.toISOString() })
            .eq('id', b.id);
        }
      }
    }

    const prune = await runPrune(now).catch(() => null);

    return NextResponse.json({ ok: true, stats, prune });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Cron failed' }, { status: 500 });
  }
}
