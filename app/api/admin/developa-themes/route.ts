import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin, isPlatformAdmin } from '@/lib/forumServer';
import { loadCatalog } from '@/lib/themeCatalog';

async function guard() {
  return (await isPlatformAdmin()) ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/** Founder view: every theme with its price, plus the purchase requests waiting for a check. */
export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const themes = await loadCatalog();
  const { data: purchases, error } = await supabaseAdmin
    .from('theme_purchases')
    .select('id, user_id, template_id, amount, status, reference, created_at, approved_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const ids = Array.from(new Set((purchases || []).map((p) => p.user_id as string)));
  const emails = new Map<string, string>();
  for (const id of ids.slice(0, 100)) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    if (data?.user?.email) emails.set(id, data.user.email);
  }
  return NextResponse.json({
    themes,
    purchases: (purchases || []).map((p) => ({ ...p, email: emails.get(p.user_id as string) || '' })),
    needs_update: !!error,
  });
}

const priceSchema = z.object({
  template_id: z.string().trim().min(1).max(60),
  price_ngn: z.number().int().min(0).max(5_000_000),
  is_active: z.boolean(),
});

/** Set a theme's price (0 makes it free) or switch it off. */
export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = priceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a whole-naira price.' }, { status: 400 });
  const known = (await loadCatalog()).some((t) => t.id === parsed.data.template_id);
  if (!known) return NextResponse.json({ error: 'Unknown theme.' }, { status: 404 });
  const { error } = await supabaseAdmin
    .from('theme_catalog')
    .upsert({ ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'template_id' });
  if (error) return NextResponse.json({ error: 'Theme prices need the latest database update first.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}

const decideSchema = z.object({ id: z.string().uuid(), status: z.enum(['paid', 'rejected']), note: z.string().trim().max(200).optional() });

/** Confirm or reject a purchase request. Confirming unlocks the theme for that person. */
export async function PATCH(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = decideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { error } = await supabaseAdmin
    .from('theme_purchases')
    .update({ status: parsed.data.status, note: parsed.data.note ?? null, approved_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('status', 'pending');
  if (error) return NextResponse.json({ error: 'Could not update the request.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Give someone a theme without a payment (a gift or a refund fix). */
export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = z.object({ email: z.string().email(), template_id: z.string().min(1).max(60) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Enter the person\'s email and a theme.' }, { status: 400 });
  const { data: profile } = await supabaseAdmin.from('profiles').select('id').ilike('email', body.data.email).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No account with that email.' }, { status: 404 });
  const { error } = await supabaseAdmin.from('theme_purchases').insert({
    user_id: profile.id,
    template_id: body.data.template_id,
    amount: 0,
    status: 'paid',
    reference: `GIFT-${Date.now().toString(36).toUpperCase()}`,
    approved_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: 'Could not grant the theme.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
