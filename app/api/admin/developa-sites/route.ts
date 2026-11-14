import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, resolveAuthorNames } from '@/lib/forumServer';
import { PLANS } from '@/lib/plans';

async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  return profile?.is_admin === true;
}

export async function GET() {
  try {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [sitesRes, productsRes, ordersRes] = await Promise.all([
      supabaseAdmin.from('forums').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('site_products').select('id, site_id, is_active'),
      supabaseAdmin.from('site_orders').select('id, site_id, total_amount, payment_status'),
    ]);

    if (sitesRes.error) throw sitesRes.error;
    const sites = sitesRes.data || [];

    const ownerNames = await resolveAuthorNames(sites.map((s) => s.owner_id));

    // Aggregate counts
    const productsBySite = new Map<string, number>();
    for (const p of productsRes.data || []) {
      productsBySite.set(p.site_id, (productsBySite.get(p.site_id) || 0) + 1);
    }

    const ordersBySite = new Map<string, { count: number; gmv: number }>();
    for (const o of ordersRes.data || []) {
      const cur = ordersBySite.get(o.site_id) || { count: 0, gmv: 0 };
      cur.count += 1;
      cur.gmv += Number(o.total_amount || 0);
      ordersBySite.set(o.site_id, cur);
    }

    const enriched = sites.map((s) => ({
      ...s,
      owner_name: ownerNames.get(s.owner_id) || 'Owner',
      total_products: productsBySite.get(s.id) || 0,
      total_orders: ordersBySite.get(s.id)?.count || 0,
      total_gmv: ordersBySite.get(s.id)?.gmv || 0,
    }));

    return NextResponse.json({ sites: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load sites';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, is_public, plan_tier, custom_domain_verified, plan_expires_at, verified } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing site id' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (is_public !== undefined) updates.is_public = is_public;
    if (plan_tier !== undefined) {
      if (!['free', 'pro', 'business'].includes(plan_tier)) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
      updates.plan_tier = plan_tier;
    }
    if (plan_expires_at !== undefined) updates.plan_expires_at = plan_expires_at;
    if (custom_domain_verified !== undefined) updates.custom_domain_verified = custom_domain_verified;
    if (typeof verified === 'boolean') {
      updates.verified = verified;
      updates.verified_at = verified ? new Date().toISOString() : null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('forums')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (/column .*verified.* does not exist/i.test(error.message)) {
        return NextResponse.json({ error: 'Seller verification requires the latest database migration first.' }, { status: 503 });
      }
      throw error;
    }
    return NextResponse.json({ site: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update site';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Record a paid plan: logs the payment and moves the site onto the plan, extending from
 * today or from the current expiry if it has not run out yet.
 * Body: { action: 'record_payment', site_id, plan_tier: 'pro'|'business', months, amount?, reference?, note? }
 */
export async function POST(request: Request) {
  try {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (body?.action !== 'record_payment') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    const tier = body.plan_tier as 'pro' | 'business';
    const months = Number(body.months);
    if (!['pro', 'business'].includes(tier) || !Number.isInteger(months) || months < 1 || months > 36 || !body.site_id) {
      return NextResponse.json({ error: 'Choose a plan, a site and 1 to 36 months.' }, { status: 400 });
    }
    const amount = body.amount !== undefined && body.amount !== '' ? Number(body.amount) : PLANS[tier].priceNgn * months;
    if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

    const { data: site } = await supabaseAdmin.from('forums').select('id, plan_expires_at').eq('id', body.site_id).single();
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const base = site.plan_expires_at && new Date(site.plan_expires_at).getTime() > Date.now() ? new Date(site.plan_expires_at) : new Date();
    base.setMonth(base.getMonth() + months);

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: payErr } = await supabaseAdmin.from('site_plan_payments').insert({
      site_id: site.id, plan_tier: tier, months, amount,
      reference: body.reference ? String(body.reference).slice(0, 120) : null,
      note: body.note ? String(body.note).slice(0, 300) : null,
      recorded_by: user?.id ?? null,
    });
    if (payErr) return NextResponse.json({ error: 'Plan payments need the latest database update first.' }, { status: 503 });

    const { data: updated, error } = await supabaseAdmin
      .from('forums')
      .update({ plan_tier: tier, plan_expires_at: base.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', site.id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ site: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
