import { supabaseAdmin } from '@/lib/forumServer';

export interface Coupon {
  id: string;
  site_id: string;
  code: string;
  kind: 'percent' | 'fixed';
  amount: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
}

/** Finds a coupon that can be used right now, or explains why not. Tolerates the table not existing yet. */
export async function findUsableCoupon(siteId: string, rawCode: string): Promise<{ coupon?: Coupon; reason?: string }> {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) return { reason: 'Enter a code.' };
  const { data, error } = await supabaseAdmin
    .from('site_coupons')
    .select('*')
    .eq('site_id', siteId)
    .eq('code', code)
    .maybeSingle();
  if (error || !data) return { reason: 'That code is not valid.' };
  const c = data as Coupon;
  if (!c.is_active) return { reason: 'That code is no longer active.' };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { reason: 'That code has expired.' };
  if (c.max_uses !== null && c.used_count >= c.max_uses) return { reason: 'That code has been fully used.' };
  return { coupon: c };
}

export function discountFor(coupon: Pick<Coupon, 'kind' | 'amount'>, subtotal: number): number {
  const raw = coupon.kind === 'percent' ? (subtotal * Math.min(100, Number(coupon.amount))) / 100 : Number(coupon.amount);
  return Math.max(0, Math.min(Math.round(raw), Math.round(subtotal)));
}
