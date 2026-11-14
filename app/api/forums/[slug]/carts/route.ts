import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { overLimit, clientIp } from '@/lib/rateLimit';
import { isMissingRelationError, readExtendedSite, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';

const saveCartSchema = z.object({
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().default(''),
  buyer_name: z.string().trim().max(100).optional().default(''),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        title: z.string().trim().max(160),
        qty: z.number().int().min(1).max(99),
        price: z.number().min(0),
      })
    )
    .min(1)
    .max(50),
  total: z.number().min(0).max(500_000_000),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.abandonedCarts) {
      return NextResponse.json({ carts: [], upgradeRequired: true });
    }

    const { data, error } = await supabaseAdmin
      .from('site_carts')
      .select('id, site_id, email, phone, buyer_name, items, total, status, reminder_count, created_at, updated_at')
      .eq('site_id', access.site.id)
      .eq('status', 'open')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ carts: [], tableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ carts: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load carts' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    if (overLimit(`cart:${slug}:${clientIp(request)}`, 25, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: true });
    }

    const raw = await request.json().catch(() => null);
    const parsed = saveCartSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid cart' }, { status: 400 });
    }

    const email = (parsed.data.email || '').trim().toLowerCase();
    const phone = parsed.data.phone.trim();
    if (!email && phone.length < 5) {
      return NextResponse.json({ ok: true });
    }

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, site_mode, plan_tier')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site || site.site_mode === 'forum') {
      return NextResponse.json({ ok: true });
    }

    const ext = await readExtendedSite(site.id);
    const plan = planFor(site.plan_tier, ext?.plan_expires_at);
    if (!plan.abandonedCarts) {
      return NextResponse.json({ ok: true });
    }

    // Never message buyers who previously unsubscribed from cart reminders on this store.
    if (email) {
      const { data: unsub, error: unsubErr } = await supabaseAdmin
        .from('site_carts')
        .select('id')
        .eq('site_id', site.id)
        .eq('email', email)
        .eq('status', 'unsubscribed')
        .limit(1)
        .maybeSingle();
      if (isMissingRelationError(unsubErr)) {
        return NextResponse.json({ ok: true });
      }
      if (unsub) return NextResponse.json({ ok: true });
    }

    const lookupCol = email ? 'email' : 'phone';
    const lookupVal = email || phone;
    const { data: existing } = await supabaseAdmin
      .from('site_carts')
      .select('id')
      .eq('site_id', site.id)
      .eq(lookupCol, lookupVal)
      .eq('status', 'open')
      .maybeSingle();

    const payload = {
      email: xss(email),
      phone: xss(phone),
      buyer_name: xss(parsed.data.buyer_name),
      items: parsed.data.items.map((it) => ({
        product_id: it.product_id,
        title: xss(it.title),
        qty: it.qty,
        price: it.price,
      })),
      total: parsed.data.total,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabaseAdmin.from('site_carts').update(payload).eq('id', existing.id);
    } else {
      await supabaseAdmin.from('site_carts').insert({
        site_id: site.id,
        status: 'open',
        unsubscribe_token: crypto.randomBytes(20).toString('hex'),
        ...payload,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
