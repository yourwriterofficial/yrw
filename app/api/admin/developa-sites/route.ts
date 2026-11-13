import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, resolveAuthorNames } from '@/lib/forumServer';

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

    const { id, is_public, plan_tier, custom_domain_verified } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing site id' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (is_public !== undefined) updates.is_public = is_public;
    if (plan_tier !== undefined) updates.plan_tier = plan_tier;
    if (custom_domain_verified !== undefined) updates.custom_domain_verified = custom_domain_verified;

    const { data: updated, error } = await supabaseAdmin
      .from('forums')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ site: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update site';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
