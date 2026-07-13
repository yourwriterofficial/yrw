import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Credits a referrer's wallet with commission on a paid order/purchase, if the
 * buyer was referred by someone. Server-side only — must be called with a
 * service-role client, since increment_wallet() refuses to credit (add_amount > 0)
 * for any non-service-role caller.
 *
 * Never throws — a referral-crediting failure must not break the underlying
 * payment flow that triggered it.
 */
export async function creditReferralCommission(
  admin: SupabaseClient,
  params: { buyerId: string; amount: number; orderId?: number | null; reference: string; note?: string }
): Promise<void> {
  const { buyerId, amount, orderId = null, reference, note } = params;
  try {
    if (!buyerId || !(amount > 0)) return;

    const { data: buyerProfile } = await admin
      .from('profiles')
      .select('referred_by')
      .eq('id', buyerId)
      .maybeSingle();

    const referrerId = buyerProfile?.referred_by;
    if (!referrerId || referrerId === buyerId) return;

    const { data: settings } = await admin
      .from('affiliate_settings')
      .select('commission_percent')
      .eq('key', 'default')
      .maybeSingle();

    const commissionPercent = Number(settings?.commission_percent ?? 10);
    const commission = Math.round(amount * (commissionPercent / 100));
    if (commission <= 0) return;

    const { error: creditErr } = await admin.rpc('increment_wallet', {
      user_id: referrerId,
      add_amount: commission,
    });
    if (creditErr) {
      console.error('Referral commission credit failed:', creditErr);
      return;
    }

    await admin.from('referrals').insert({
      referrer_id: referrerId,
      referred_id: buyerId,
      order_id: orderId,
      commission_earned: commission,
      status: 'completed',
    });

    await admin.from('transactions').insert({
      user_id: referrerId,
      amount: commission,
      type: 'referral_commission',
      reference: `REFCOMM_${reference}`,
      status: 'completed',
      notes: note || 'Referral commission',
    });
  } catch (e) {
    console.error('creditReferralCommission error:', e);
  }
}

/**
 * Links a freshly-created profile to whoever referred them, resolved from a
 * `?ref=<permalink>` code captured at signup time. Only ever takes effect once
 * (a profile's referred_by is permanent) and never on self-referral. Server-side
 * only — looking up another user's profile by permalink requires bypassing RLS.
 */
export async function applyReferralIfEligible(
  admin: SupabaseClient,
  params: { userId: string; refCode: string | null | undefined }
): Promise<void> {
  try {
    const { userId, refCode } = params;
    if (!userId || !refCode) return;

    const { data: profile } = await admin
      .from('profiles')
      .select('referred_by')
      .eq('id', userId)
      .maybeSingle();
    if (!profile || profile.referred_by) return;

    const { data: referrer } = await admin
      .from('profiles')
      .select('id')
      .ilike('permalink', refCode)
      .maybeSingle();
    if (!referrer || referrer.id === userId) return;

    await admin
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', userId)
      .is('referred_by', null);
  } catch (e) {
    console.error('applyReferralIfEligible error:', e);
  }
}
