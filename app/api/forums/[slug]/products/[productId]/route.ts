import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { planFor } from '@/lib/plans';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';

const httpsUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\//i.test(v), 'Photo URLs must use https://');

const updateProductSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1500).optional(),
  category: z.string().trim().max(50).optional(),
  product_type: z.enum(['physical', 'digital', 'service']).optional(),
  price: z.coerce.number().min(0).max(100_000_000).optional(),
  compare_at_price: z.union([z.coerce.number().min(0), z.null()]).optional(),
  image_url: httpsUrlSchema.optional(),
  image_urls: z.array(z.string().trim().max(500).refine((v) => /^https:\/\//i.test(v), 'Photo URLs must use https://')).max(6).optional(),
  digital_url: z.string().trim().max(500).optional(),
  stock_qty: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  low_stock_at: z.coerce.number().int().min(0).max(1000).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; productId: string }> }
) {
  try {
    const { slug, productId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;
    const { site } = access;
    const plan = planFor(site.plan_tier, site.plan_expires_at);

    const raw = await request.json().catch(() => null);
    const parsed = updateProductSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) updates.title = xss(parsed.data.title);
    if (parsed.data.description !== undefined) updates.description = xss(parsed.data.description);
    if (parsed.data.category !== undefined) updates.category = xss(parsed.data.category);
    if (parsed.data.product_type !== undefined) updates.product_type = parsed.data.product_type;
    if (parsed.data.price !== undefined) updates.price = parsed.data.price;
    if (parsed.data.compare_at_price !== undefined) updates.compare_at_price = parsed.data.compare_at_price;
    if (parsed.data.digital_url !== undefined) updates.digital_url = xss(parsed.data.digital_url);
    if (parsed.data.stock_qty !== undefined) updates.stock_qty = parsed.data.stock_qty;
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

    let urlsCount = 0;
    if (parsed.data.image_urls !== undefined) {
      const urls = Array.from(new Set(parsed.data.image_urls.map((u) => u.trim()).filter(Boolean)));
      urlsCount = urls.length;
      if (urls.length > plan.maxProductPhotos) {
        return NextResponse.json(
          { error: `The ${plan.name} plan allows ${plan.maxProductPhotos} photo per product. Upgrade to Pro to add up to 6 photos.` },
          { status: 403 }
        );
      }
      updates.image_urls = urls.map((u) => xss(u));
      updates.image_url = xss(urls[0] || '');
    } else if (parsed.data.image_url !== undefined) {
      updates.image_url = xss(parsed.data.image_url);
      updates.image_urls = parsed.data.image_url ? [xss(parsed.data.image_url)] : [];
    }

    if (parsed.data.low_stock_at !== undefined) {
      updates.low_stock_at = parsed.data.low_stock_at;
    }

    let { data: product, error } = await supabaseAdmin
      .from('site_products')
      .update(updates)
      .eq('id', productId)
      .eq('site_id', site.id)
      .select('*')
      .single();

    if (error && /column .* does not exist/i.test(error.message)) {
      if (urlsCount > 1) {
        return NextResponse.json({ error: 'Multiple product photos need the latest database update first.' }, { status: 503 });
      }
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.image_urls;
      delete fallbackUpdates.low_stock_at;
      const fallback = await supabaseAdmin
        .from('site_products')
        .update(fallbackUpdates)
        .eq('id', productId)
        .eq('site_id', site.id)
        .select('*')
        .single();
      product = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return NextResponse.json({ product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string; productId: string }> }
) {
  try {
    const { slug, productId } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const { error } = await supabaseAdmin
      .from('site_products')
      .delete()
      .eq('id', productId)
      .eq('site_id', access.site.id);

    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
