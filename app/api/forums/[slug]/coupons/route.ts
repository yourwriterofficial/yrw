import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin, requireOwnedSite } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';

type Ctx = { params: Promise<{ slug: string }> };

const createSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, 'Use 3 to 20 letters, numbers, - or _'),
  kind: z.enum(['percent', 'fixed']),
  amount: z.coerce.number().positive().max(10_000_000),
  max_uses: z.coerce.number().int().positive().max(1_000_000).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  const r = await requireOwnedSite((await ctx.params).slug);
  if ('error' in r) return r.error;
  const { data, error } = await supabaseAdmin.from('site_coupons').select('*').eq('site_id', r.site.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ coupons: [], needs_update: true });
  return NextResponse.json({ coupons: data || [] });
}

export async function POST(req: Request, ctx: Ctx) {
  const r = await requireOwnedSite((await ctx.params).slug);
  if ('error' in r) return r.error;
  if (!planFor(r.site.plan_tier, (r.site as { plan_expires_at?: string | null }).plan_expires_at).coupons) {
    return NextResponse.json({ error: 'Discount coupons are part of the Pro plan.' }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid coupon' }, { status: 400 });
  if (parsed.data.kind === 'percent' && parsed.data.amount > 100) {
    return NextResponse.json({ error: 'A percentage discount cannot be more than 100.' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('site_coupons')
    .insert({ site_id: r.site.id, code: parsed.data.code, kind: parsed.data.kind, amount: parsed.data.amount, max_uses: parsed.data.max_uses ?? null, expires_at: parsed.data.expires_at ?? null })
    .select('*')
    .single();
  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return NextResponse.json({ error: dup ? 'You already have a coupon with that code.' : 'Coupons need the latest database update first.' }, { status: dup ? 409 : 503 });
  }
  return NextResponse.json({ coupon: data }, { status: 201 });
}
