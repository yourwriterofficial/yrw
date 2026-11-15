import { supabaseAdmin } from '@/lib/forumServer';
import { PLANS, type PlanTier } from '@/lib/plans';
import { verifyTransaction, type PaystackVerifiedTx } from '@/lib/paystack';

export interface SettleResult {
  ok: boolean;
  kind?: string;
  alreadyPaid?: boolean;
  redirectPath?: string;
  error?: string;
}

/**
 * Verifies a Developa Paystack reference server-to-server, atomically claims
 * the pending record once, and activates the plan, theme, ad booking or store order.
 * Safe to call from both `/api/developa/pay/return` and daily reconciliation.
 */
export async function settleDevelopaPayment(reference: string): Promise<SettleResult> {
  if (!reference || !reference.startsWith('dev_')) {
    return { ok: false, error: 'Invalid Developa payment reference.' };
  }

  let tx: PaystackVerifiedTx;
  try {
    tx = await verifyTransaction(reference);
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Verification failed.' };
  }

  if (tx.status !== 'success') {
    return { ok: false, error: `Payment status is ${tx.status}.` };
  }

  const meta = tx.metadata;
  if (meta?.app !== 'developa' || !meta.kind) {
    return { ok: false, error: 'Not a Developa transaction.' };
  }

  if (meta.kind === 'plan') {
    const { data: pending } = await supabaseAdmin
      .from('site_plan_payments')
      .select('id, site_id, plan_tier, months, amount, status')
      .eq('reference', reference)
      .maybeSingle();

    if (!pending) return { ok: false, error: 'Plan payment record not found.' };
    if (pending.status === 'paid') {
      return { ok: true, kind: 'plan', alreadyPaid: true, redirectPath: meta.slug ? `/developer/manage/${meta.slug}` : '/create' };
    }
    if (tx.amount < Math.round(Number(pending.amount) * 100)) {
      return { ok: false, error: 'Paid amount is less than expected.' };
    }

    const { data: claimed } = await supabaseAdmin
      .from('site_plan_payments')
      .update({ status: 'paid' })
      .eq('id', pending.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimed) {
      return { ok: true, kind: 'plan', alreadyPaid: true, redirectPath: meta.slug ? `/developer/manage/${meta.slug}` : '/create' };
    }

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, plan_expires_at')
      .eq('id', pending.site_id)
      .maybeSingle();

    if (site) {
      const base = site.plan_expires_at && new Date(site.plan_expires_at).getTime() > Date.now()
        ? new Date(site.plan_expires_at)
        : new Date();
      base.setMonth(base.getMonth() + Number(pending.months));
      const tier = pending.plan_tier as PlanTier;
      await supabaseAdmin.from('forums').update({
        plan_tier: tier,
        plan_expires_at: base.toISOString(),
        hide_branding: PLANS[tier]?.hideBranding ?? false,
        updated_at: new Date().toISOString(),
      }).eq('id', site.id);
      return { ok: true, kind: 'plan', redirectPath: `/developer/manage/${site.slug}?tab=plan&paid=1` };
    }
    return { ok: true, kind: 'plan', redirectPath: '/create?paid=1' };
  }

  if (meta.kind === 'theme') {
    const { data: pending } = await supabaseAdmin
      .from('theme_purchases')
      .select('id, user_id, template_id, amount_ngn, status')
      .eq('reference', reference)
      .maybeSingle();

    if (!pending) return { ok: false, error: 'Theme purchase record not found.' };
    if (pending.status === 'paid') {
      return { ok: true, kind: 'theme', alreadyPaid: true, redirectPath: meta.slug ? `/developer/manage/${meta.slug}?tab=settings` : '/create' };
    }
    if (tx.amount < Math.round(Number(pending.amount_ngn) * 100)) {
      return { ok: false, error: 'Paid amount is less than expected.' };
    }

    await supabaseAdmin
      .from('theme_purchases')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', pending.id)
      .eq('status', 'pending');

    return { ok: true, kind: 'theme', redirectPath: meta.slug ? `/developer/manage/${meta.slug}?tab=settings&theme_paid=1` : '/create' };
  }

  if (meta.kind === 'ad_booking') {
    const { data: booking } = await supabaseAdmin
      .from('site_ad_bookings')
      .select('id, site_id, slot_id, amount_ngn, status')
      .eq('reference', reference)
      .maybeSingle();

    if (!booking) return { ok: false, error: 'Ad booking record not found.' };
    if (booking.status === 'approved') {
      return { ok: true, kind: 'ad_booking', alreadyPaid: true, redirectPath: meta.slug ? `/forums/${meta.slug}` : '/create' };
    }
    if (tx.amount < Math.round(Number(booking.amount_ngn) * 100)) {
      return { ok: false, error: 'Paid amount is less than expected.' };
    }

    const { data: slot } = await supabaseAdmin
      .from('site_ad_slots')
      .select('days')
      .eq('id', booking.slot_id)
      .maybeSingle();

    const days = Math.max(1, Number(slot?.days || 7));
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 86_400_000);

    await supabaseAdmin
      .from('site_ad_bookings')
      .update({
        status: 'approved',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .eq('id', booking.id)
      .eq('status', 'pending');

    return { ok: true, kind: 'ad_booking', redirectPath: meta.slug ? `/forums/${meta.slug}?ad_booked=1` : '/create' };
  }

  if (meta.kind === 'store_order') {
    const { data: order } = await supabaseAdmin
      .from('site_orders')
      .select('id, site_id, order_code, total_ngn, payment_status')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (!order) return { ok: false, error: 'Store order not found.' };
    if (order.payment_status === 'paid') {
      return { ok: true, kind: 'store_order', alreadyPaid: true, redirectPath: meta.slug ? `/forums/${meta.slug}?order=${order.order_code}&paid=1` : '/' };
    }
    if (tx.amount < Math.round(Number(order.total_ngn) * 100)) {
      return { ok: false, error: 'Paid amount is less than expected.' };
    }

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('plan_tier, plan_expires_at, paystack_split_fee_pct')
      .eq('id', order.site_id)
      .maybeSingle();

    const feePct = Number(site?.paystack_split_fee_pct ?? 2);
    const gross = Number(order.total_ngn);
    const platformFee = Math.round(((gross * feePct) / 100) * 100) / 100;
    const sellerNet = Math.max(0, Math.round((gross - platformFee) * 100) / 100);

    await supabaseAdmin
      .from('site_orders')
      .update({
        payment_status: 'paid',
        platform_fee_ngn: platformFee,
        seller_net_ngn: sellerNet,
      })
      .eq('id', order.id)
      .eq('payment_status', 'pending');

    return { ok: true, kind: 'store_order', redirectPath: meta.slug ? `/forums/${meta.slug}?order=${order.order_code}&paid=1` : '/' };
  }

  return { ok: false, error: 'Unsupported payment kind.' };
}
