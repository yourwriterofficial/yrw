import { NextResponse } from 'next/server';
import { supabaseAdmin, requireOwnedSite } from '@/lib/forumServer';

type Ctx = { params: Promise<{ slug: string; couponId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { slug, couponId } = await ctx.params;
  const r = await requireOwnedSite(slug);
  if ('error' in r) return r.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.is_active !== 'boolean') return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('site_coupons').update({ is_active: body.is_active }).eq('id', couponId).eq('site_id', r.site.id);
  if (error) return NextResponse.json({ error: 'Could not update the coupon.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { slug, couponId } = await ctx.params;
  const r = await requireOwnedSite(slug);
  if ('error' in r) return r.error;
  await supabaseAdmin.from('site_coupons').delete().eq('id', couponId).eq('site_id', r.site.id);
  return NextResponse.json({ ok: true });
}
