import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { planFor } from '@/lib/plans';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, 'Variant name is required').max(120),
  options: z.record(z.string(), z.string()).optional().default({}),
  price: z.coerce.number().min(0).max(100_000_000),
  stock_qty: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  sku: z.string().trim().max(60).optional().default(''),
  sort_order: z.coerce.number().int().min(0).max(1000).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

const bulkSaveSchema = z.object({
  variant_options: z.array(z.string().trim().min(1).max(40)).max(5).optional().default([]),
  variants: z.array(variantSchema).max(100),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; productId: string }> }
) {
  try {
    const { slug, productId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager', 'packer', 'support']);
    if ('error' in access) return access.error;

    const { data, error } = await supabaseAdmin
      .from('site_product_variants')
      .select('*')
      .eq('site_id', access.site.id)
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (/relation .* does not exist/i.test(error.message)) {
        return NextResponse.json({ variants: [], needs_update: true });
      }
      throw error;
    }
    return NextResponse.json({ variants: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load variants' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; productId: string }> }
) {
  try {
    const { slug, productId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;
    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.variants) {
      return NextResponse.json({ error: 'Product variants require the Pro plan.' }, { status: 403 });
    }

    const { data: prod } = await supabaseAdmin
      .from('site_products')
      .select('id')
      .eq('id', productId)
      .eq('site_id', access.site.id)
      .maybeSingle();
    if (!prod) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const raw = await request.json().catch(() => null);
    const parsed = variantSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid variant' }, { status: 400 });
    }

    const cleanOptions: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.data.options || {})) {
      if (k.trim() && v.trim()) cleanOptions[xss(k.trim())] = xss(v.trim());
    }

    const { data: variant, error } = await supabaseAdmin
      .from('site_product_variants')
      .insert({
        site_id: access.site.id,
        product_id: productId,
        label: xss(parsed.data.label),
        options: cleanOptions,
        price: parsed.data.price,
        stock_qty: parsed.data.stock_qty ?? null,
        sku: xss(parsed.data.sku),
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
      })
      .select('*')
      .single();

    if (error) {
      if (/relation .* does not exist/i.test(error.message)) {
        return NextResponse.json({ error: 'Product variants need the latest database update first.' }, { status: 503 });
      }
      throw error;
    }

    return NextResponse.json({ variant }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create variant' }, { status: 500 });
  }
}

/** Bulk saves option names + variants list for a product. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string; productId: string }> }
) {
  try {
    const { slug, productId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;
    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.variants) {
      return NextResponse.json({ error: 'Product variants require the Pro plan.' }, { status: 403 });
    }

    const { data: prod } = await supabaseAdmin
      .from('site_products')
      .select('id')
      .eq('id', productId)
      .eq('site_id', access.site.id)
      .maybeSingle();
    if (!prod) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const raw = await request.json().catch(() => null);
    const parsed = bulkSaveSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid variants' }, { status: 400 });
    }

    const cleanOptionNames = parsed.data.variant_options.map((o) => xss(o));
    const { error: prodErr } = await supabaseAdmin
      .from('site_products')
      .update({ variant_options: cleanOptionNames })
      .eq('id', productId)
      .eq('site_id', access.site.id);
    if (prodErr && /column .* does not exist/i.test(prodErr.message)) {
      return NextResponse.json({ error: 'Product variants need the latest database update first.' }, { status: 503 });
    }

    const { data: existingRows, error: exErr } = await supabaseAdmin
      .from('site_product_variants')
      .select('id')
      .eq('product_id', productId)
      .eq('site_id', access.site.id);
    if (exErr) {
      if (/relation .* does not exist/i.test(exErr.message)) {
        return NextResponse.json({ error: 'Product variants need the latest database update first.' }, { status: 503 });
      }
      throw exErr;
    }

    const keepIds = new Set(parsed.data.variants.map((v) => v.id).filter(Boolean) as string[]);
    const toDelete = (existingRows || []).map((r) => r.id as string).filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      await supabaseAdmin.from('site_product_variants').delete().in('id', toDelete).eq('site_id', access.site.id);
    }

    const saved = [];
    for (let idx = 0; idx < parsed.data.variants.length; idx++) {
      const v = parsed.data.variants[idx];
      const cleanOptions: Record<string, string> = {};
      for (const [k, val] of Object.entries(v.options || {})) {
        if (k.trim() && val.trim()) cleanOptions[xss(k.trim())] = xss(val.trim());
      }
      const payload = {
        site_id: access.site.id,
        product_id: productId,
        label: xss(v.label),
        options: cleanOptions,
        price: v.price,
        stock_qty: v.stock_qty ?? null,
        sku: xss(v.sku || ''),
        sort_order: idx,
        is_active: v.is_active ?? true,
      };
      if (v.id) {
        const { data: upd, error: uErr } = await supabaseAdmin
          .from('site_product_variants')
          .update(payload)
          .eq('id', v.id)
          .eq('product_id', productId)
          .eq('site_id', access.site.id)
          .select('*')
          .single();
        if (uErr) throw uErr;
        if (upd) saved.push(upd);
      } else {
        const { data: ins, error: iErr } = await supabaseAdmin
          .from('site_product_variants')
          .insert(payload)
          .select('*')
          .single();
        if (iErr) throw iErr;
        if (ins) saved.push(ins);
      }
    }

    return NextResponse.json({ variants: saved, variant_options: cleanOptionNames });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save variants' }, { status: 500 });
  }
}
