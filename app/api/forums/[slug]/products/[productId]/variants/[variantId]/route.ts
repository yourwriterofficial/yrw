import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { planFor } from '@/lib/plans';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';

const patchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  options: z.record(z.string(), z.string()).optional(),
  price: z.coerce.number().min(0).max(100_000_000).optional(),
  stock_qty: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  sku: z.string().trim().max(60).optional(),
  sort_order: z.coerce.number().int().min(0).max(1000).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; productId: string; variantId: string }> }
) {
  try {
    const { slug, productId, variantId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;
    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.variants) {
      return NextResponse.json({ error: 'Product variants require the Pro plan.' }, { status: 403 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid variant' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) updates.label = xss(parsed.data.label);
    if (parsed.data.price !== undefined) updates.price = parsed.data.price;
    if (parsed.data.stock_qty !== undefined) updates.stock_qty = parsed.data.stock_qty;
    if (parsed.data.sku !== undefined) updates.sku = xss(parsed.data.sku);
    if (parsed.data.sort_order !== undefined) updates.sort_order = parsed.data.sort_order;
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;
    if (parsed.data.options !== undefined) {
      const cleanOptions: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.data.options)) {
        if (k.trim() && v.trim()) cleanOptions[xss(k.trim())] = xss(v.trim());
      }
      updates.options = cleanOptions;
    }

    const { data: variant, error } = await supabaseAdmin
      .from('site_product_variants')
      .update(updates)
      .eq('id', variantId)
      .eq('product_id', productId)
      .eq('site_id', access.site.id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ variant });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update variant' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string; productId: string; variantId: string }> }
) {
  try {
    const { slug, productId, variantId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const { error } = await supabaseAdmin
      .from('site_product_variants')
      .delete()
      .eq('id', variantId)
      .eq('product_id', productId)
      .eq('site_id', access.site.id);

    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete variant' }, { status: 500 });
  }
}
