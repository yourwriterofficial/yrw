import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';

const sendSchema = z.object({
  subject: z.string().trim().min(3, 'Subject is required').max(140),
  body: z.string().trim().min(10, 'Write a brief message to buyers').max(6000),
});

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    const monthKey = new Date().toISOString().slice(0, 7);

    const [logsRes, subsRes] = await Promise.all([
      supabaseAdmin
        .from('site_newsletters')
        .select('id, subject, sent_count, month_key, created_at')
        .eq('site_id', access.site.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('site_subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', access.site.id)
        .eq('marketing_consent', true)
        .is('unsubscribed_at', null),
    ]);

    if (logsRes.error && /relation .*site_newsletters.* does not exist/i.test(logsRes.error.message)) {
      return NextResponse.json({
        newsletters: [],
        sentThisMonth: 0,
        limitPerMonth: plan.newsletterLimitPerMonth,
        subscriberCount: 0,
        tableMissing: true,
      });
    }

    const newsletters = logsRes.data || [];
    const sentThisMonth = newsletters
      .filter((n) => n.month_key === monthKey)
      .reduce((sum, n) => sum + (Number(n.sent_count) || 0), 0);

    return NextResponse.json({
      newsletters,
      sentThisMonth,
      limitPerMonth: plan.newsletterLimitPerMonth,
      subscriberCount: subsRes.count || 0,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load newsletters' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (plan.newsletterLimitPerMonth <= 0) {
      return NextResponse.json({ error: 'Customer newsletters are available on Pro and Business plans.' }, { status: 403 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = sendSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid campaign' }, { status: 400 });
    }

    const monthKey = new Date().toISOString().slice(0, 7);
    const { data: monthLogs, error: cntErr } = await supabaseAdmin
      .from('site_newsletters')
      .select('sent_count')
      .eq('site_id', access.site.id)
      .eq('month_key', monthKey);

    if (cntErr && /relation .*site_newsletters.* does not exist/i.test(cntErr.message)) {
      return NextResponse.json({ error: 'Newsletters need the latest database update first.' }, { status: 503 });
    }
    const usedEmails = (monthLogs || []).reduce((sum, row) => sum + (Number(row.sent_count) || 0), 0);
    if (usedEmails >= plan.newsletterLimitPerMonth) {
      return NextResponse.json({ error: `Monthly send limit of ${plan.newsletterLimitPerMonth.toLocaleString()} emails reached.` }, { status: 403 });
    }

    const remainingQuota = plan.newsletterLimitPerMonth - usedEmails;
    const { data: subs, error: subErr } = await supabaseAdmin
      .from('site_subscribers')
      .select('email, name, unsubscribe_token')
      .eq('site_id', access.site.id)
      .eq('marketing_consent', true)
      .is('unsubscribed_at', null)
      .limit(Math.min(500, remainingQuota));

    if (subErr) {
      if (/relation .*site_subscribers.* does not exist/i.test(subErr.message)) {
        return NextResponse.json({ error: 'Subscribers require the latest database update first.' }, { status: 503 });
      }
      throw subErr;
    }

    const recipients = subs || [];
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No opted-in subscribers yet.' }, { status: 400 });
    }

    const storeHref = `${siteUrl()}/forums/${access.site.slug}`;
    const bodyParagraphs = parsed.data.body
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`)
      .join('');

    let sentCount = 0;
    for (const r of recipients) {
      const unsubHref = `${siteUrl()}/api/forums/${encodeURIComponent(access.site.slug)}/newsletter/unsubscribe?token=${encodeURIComponent(r.unsubscribe_token)}`;
      const ok = await sendSystemEmail({
        to: r.email,
        subject: `${access.site.name}: ${parsed.data.subject}`,
        html: emailShell(
          `${bodyParagraphs}<p style="font-size:12px;color:#71717a;margin-top:20px">You received this because you opted in at ${esc(access.site.name)}. <a href="${esc(unsubHref)}">Unsubscribe</a></p>`,
          `Visit ${access.site.name}`,
          storeHref,
          'developa'
        ),
      }).catch(() => false);
      if (ok) sentCount++;
    }

    const { data: log } = await supabaseAdmin
      .from('site_newsletters')
      .insert({
        site_id: access.site.id,
        subject: xss(parsed.data.subject),
        body: xss(parsed.data.body),
        sent_count: sentCount,
        month_key: monthKey,
        created_by: access.user.id,
      })
      .select('id, subject, sent_count, month_key, created_at')
      .single();

    return NextResponse.json({ sent_count: sentCount, newsletter: log }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send newsletter' }, { status: 500 });
  }
}
