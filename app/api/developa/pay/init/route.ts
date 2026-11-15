import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin, requireOwnedSite } from '@/lib/forumServer';
import { PAID_TIERS, PLANS, effectiveTier, priceForPeriod, type PlanTier } from '@/lib/plans';
import { pluginOn } from '@/lib/plugins';
import { readPluginSettings } from '@/lib/pluginsServer';
import { initializeCheckout, paystackErrorResponse, referenceFor } from '@/lib/paystack';
import { clientIp, overLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const initSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('plan'),
    slug: z.string().min(1),
    plan_tier: z.enum(['lite', 'pro', 'business', 'corporate']),
    months: z.number().int().min(1).max(36).default(1),
  }),
  z.object({
    kind: z.literal('theme'),
    slug: z.string().min(1).optional(),
    template_id: z.string().min(1).max(80),
  }),
  z.object({
    kind: z.literal('ad_booking'),
    slug: z.string().min(1),
    booking_id: z.string().uuid(),
  }),
  z.object({
    kind: z.literal('store_order'),
    slug: z.string().min(1),
    order_code: z.string().min(1).max(40),
    buyer_email: z.string().email(),
  }),
]);

export async function POST(request: Request) {
  try {
    if (overLimit(`pay-init:${clientIp(request)}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many payment requests. Please wait a moment.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = initSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment parameters.' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const callbackUrl = `${origin}/api/developa/pay/return`;
    const suffix = randomBytes(6).toString('hex');
    const data = parsed.data;

    if (data.kind === 'plan') {
      const owned = await requireOwnedSite(data.slug);
      if ('error' in owned) return owned.error;
      const tier = data.plan_tier as PlanTier;
      if (!PAID_TIERS.includes(tier)) {
        return NextResponse.json({ error: 'Invalid plan tier.' }, { status: 400 });
      }
      const amountNgn = priceForPeriod(tier, data.months);
      const ref = referenceFor(`dev_plan_${suffix}`);

      const { error: insertErr } = await supabaseAdmin.from('site_plan_payments').insert({
        site_id: owned.site.id,
        plan_tier: tier,
        months: data.months,
        amount: amountNgn,
        reference: ref,
        status: 'pending',
        note: `Paystack checkout (${data.months}m)`,
        recorded_by: owned.user.id,
      });
      if (insertErr) throw insertErr;

      const checkout = await initializeCheckout({
        email: owned.user.email || 'owner@developa.me',
        amountKobo: amountNgn * 100,
        reference: ref,
        callbackUrl,
        meta: {
          app: 'developa',
          kind: 'plan',
          siteId: owned.site.id,
          slug: owned.site.slug,
          userId: owned.user.id,
          planTier: tier,
          months: data.months,
        },
      });
      return NextResponse.json({ authorization_url: checkout.authorization_url, reference: checkout.reference });
    }

    if (data.kind === 'theme') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

      const { data: cat } = await supabaseAdmin
        .from('theme_catalog')
        .select('template_id, price_ngn, is_active')
        .eq('template_id', data.template_id)
        .maybeSingle();

      const priceNgn = Number(cat?.price_ngn ?? 0);
      if (!cat || cat.is_active === false || priceNgn <= 0) {
        return NextResponse.json({ error: 'Theme is not available for purchase.' }, { status: 400 });
      }

      const ref = referenceFor(`dev_theme_${suffix}`);
      const { error: insertErr } = await supabaseAdmin.from('theme_purchases').insert({
        user_id: user.id,
        template_id: data.template_id,
        amount_ngn: priceNgn,
        reference: ref,
        status: 'pending',
      });
      if (insertErr) throw insertErr;

      const checkout = await initializeCheckout({
        email: user.email || 'owner@developa.me',
        amountKobo: priceNgn * 100,
        reference: ref,
        callbackUrl,
        meta: {
          app: 'developa',
          kind: 'theme',
          slug: data.slug,
          userId: user.id,
          templateId: data.template_id,
        },
      });
      return NextResponse.json({ authorization_url: checkout.authorization_url, reference: checkout.reference });
    }

    if (data.kind === 'ad_booking') {
      const { data: booking } = await supabaseAdmin
        .from('site_ad_bookings')
        .select('id, site_id, advertiser_email, amount_ngn, status')
        .eq('id', data.booking_id)
        .maybeSingle();

      if (!booking || booking.status !== 'pending' || Number(booking.amount_ngn) <= 0) {
        return NextResponse.json({ error: 'Pending ad booking not found.' }, { status: 404 });
      }

      const ref = referenceFor(`dev_ad_${suffix}`);
      await supabaseAdmin
        .from('site_ad_bookings')
        .update({ reference: ref })
        .eq('id', booking.id);

      const checkout = await initializeCheckout({
        email: booking.advertiser_email,
        amountKobo: Math.round(Number(booking.amount_ngn) * 100),
        reference: ref,
        callbackUrl,
        meta: {
          app: 'developa',
          kind: 'ad_booking',
          siteId: booking.site_id,
          slug: data.slug,
          bookingId: booking.id,
        },
      });
      return NextResponse.json({ authorization_url: checkout.authorization_url, reference: checkout.reference });
    }

    // kind === 'store_order' (Paystack Subaccount Split Checkout)
    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, plan_tier, plan_expires_at, paystack_subaccount_code, paystack_split_fee_pct')
      .eq('slug', data.slug.toLowerCase().trim())
      .maybeSingle();

    if (!site || !site.paystack_subaccount_code) {
      return NextResponse.json({ error: 'Online card/transfer checkout is not enabled on this store.' }, { status: 400 });
    }

    const tier = effectiveTier(site.plan_tier, site.plan_expires_at);
    const settings = await readPluginSettings(site.id);
    if (!PLANS[tier].onlinePayments || !pluginOn('online_payments', site.plan_tier, site.plan_expires_at, settings)) {
      return NextResponse.json({ error: 'Online payments plugin is not active on this store.' }, { status: 403 });
    }

    const { data: order } = await supabaseAdmin
      .from('site_orders')
      .select('id, order_code, total_ngn, buyer_email, payment_status')
      .eq('site_id', site.id)
      .eq('order_code', data.order_code)
      .maybeSingle();

    if (!order || order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Unpaid order not found.' }, { status: 404 });
    }

    const ref = referenceFor(`dev_ord_${suffix}`);
    await supabaseAdmin
      .from('site_orders')
      .update({ paystack_reference: ref })
      .eq('id', order.id);

    const splitFeePct = Number(site.paystack_split_fee_pct ?? PLANS[tier].splitFeePct);
    const checkout = await initializeCheckout({
      email: data.buyer_email || order.buyer_email,
      amountKobo: Math.round(Number(order.total_ngn) * 100),
      reference: ref,
      callbackUrl,
      subaccount: site.paystack_subaccount_code,
      percentageCharge: splitFeePct,
      meta: {
        app: 'developa',
        kind: 'store_order',
        siteId: site.id,
        slug: site.slug,
        orderId: order.id,
      },
    });

    return NextResponse.json({ authorization_url: checkout.authorization_url, reference: checkout.reference });
  } catch (err: unknown) {
    return paystackErrorResponse(err, 'Could not start checkout. Please try again.');
  }
}
