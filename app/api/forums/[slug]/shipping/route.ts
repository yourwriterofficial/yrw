import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { readExtendedSite, readSiteTools, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';

const zoneSchema = z.object({
  name: z.string().trim().min(1).max(80),
  states: z.array(z.string().trim().min(1).max(40)).max(45),
  fee: z.number().min(0).max(10_000_000),
  free_over: z.number().min(0).max(100_000_000).nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

const putSchema = z.object({
  zones: z.array(zoneSchema).max(30),
  pickup_address: z.string().trim().max(400).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, is_public, plan_tier')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    let isStaff = false;
    const access = await requireSiteAccess(slug, ['owner', 'manager', 'packer', 'support']);
    if (!('error' in access)) {
      isStaff = true;
    } else if (!site.is_public) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const [tools, zonesRes] = await Promise.all([
      readSiteTools(site.id),
      supabaseAdmin
        .from('site_shipping_zones')
        .select('id, site_id, name, states, fee, free_over, is_active')
        .eq('site_id', site.id)
        .order('created_at', { ascending: true }),
    ]);

    if (zonesRes.error && /relation .*site_shipping_zones.* does not exist/i.test(zonesRes.error.message)) {
      return NextResponse.json({ zones: [], pickup_address: tools.pickup_address, tableMissing: true });
    }
    if (zonesRes.error) throw zonesRes.error;

    const allZones = zonesRes.data || [];
    const ext = await readExtendedSite(site.id);
    const plan = planFor(site.plan_tier, ext?.plan_expires_at);

    return NextResponse.json({
      zones: isStaff ? allZones : plan.shippingZones ? allZones.filter((z) => z.is_active) : [],
      pickup_address: tools.pickup_address,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load shipping zones' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.shippingZones) {
      return NextResponse.json({ error: 'Delivery zones are available on Pro and Business plans.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid shipping setup' }, { status: 400 });
    }

    if (parsed.data.pickup_address !== undefined) {
      const { error: pickErr } = await supabaseAdmin
        .from('forums')
        .update({ pickup_address: xss(parsed.data.pickup_address) })
        .eq('id', access.site.id);
      if (pickErr && /column .*pickup_address.* does not exist/i.test(pickErr.message)) {
        return NextResponse.json({ error: 'Store pickup needs the latest database update first.' }, { status: 503 });
      }
      if (pickErr) throw pickErr;
    }

    const { error: delErr } = await supabaseAdmin
      .from('site_shipping_zones')
      .delete()
      .eq('site_id', access.site.id);
    if (delErr) {
      if (/relation .*site_shipping_zones.* does not exist/i.test(delErr.message)) {
        return NextResponse.json({ error: 'Delivery zones need the latest database update first.' }, { status: 503 });
      }
      throw delErr;
    }

    if (parsed.data.zones.length > 0) {
      const rows = parsed.data.zones.map((z) => ({
        site_id: access.site.id,
        name: xss(z.name),
        states: z.states.map((s) => xss(s)),
        fee: z.fee,
        free_over: z.free_over ?? null,
        is_active: z.is_active,
      }));
      const { error: insErr } = await supabaseAdmin.from('site_shipping_zones').insert(rows);
      if (insErr) throw insErr;
    }

    const { data: saved } = await supabaseAdmin
      .from('site_shipping_zones')
      .select('id, site_id, name, states, fee, free_over, is_active')
      .eq('site_id', access.site.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ zones: saved || [], pickup_address: parsed.data.pickup_address ?? '' });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save delivery zones' }, { status: 500 });
  }
}
