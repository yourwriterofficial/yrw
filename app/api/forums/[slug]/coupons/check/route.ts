import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/forumServer';
import { findUsableCoupon, discountFor } from '@/lib/coupons';
import { overLimit, clientIp } from '@/lib/rateLimit';

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (overLimit(`coupon-check:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ valid: false, message: 'Too many tries. Please wait a few minutes.' }, { status: 429 });
  }
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => null);
  const subtotal = Number(body?.subtotal);
  const { data: site } = await supabaseAdmin.from('forums').select('id').eq('slug', slug.toLowerCase().trim()).maybeSingle();
  if (!site || !Number.isFinite(subtotal) || subtotal <= 0) return NextResponse.json({ valid: false, message: 'That code is not valid.' });
  const { coupon, reason } = await findUsableCoupon(site.id, String(body?.code || ''));
  if (!coupon) return NextResponse.json({ valid: false, message: reason });
  return NextResponse.json({ valid: true, discount: discountFor(coupon, subtotal), code: coupon.code });
}
