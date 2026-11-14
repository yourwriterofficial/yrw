import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { planFor } from '@/lib/plans';
import { isMissingColumnError, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';

const httpsUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\//i.test(v), 'Photo URLs must use https://');

const productSchema = z.object({
  title: z.string().trim().min(2, 'Product title is required').max(120),
  description: z.string().trim().max(1500).optional().default(''),
  category: z.string().trim().max(50).optional().default('General'),
  product_type: z.enum(['physical', 'digital', 'service']).optional().default('physical'),
  price: z.coerce.number().min(0, 'Price cannot be negative').max(100_000_000),
  compare_at_price: z.union([z.coerce.number().min(0), z.null()]).optional(),
  image_url: httpsUrlSchema.optional().default(''),
  image_urls: z.array(z.string().trim().max(500).refine((v) => /^https:\/\//i.test(v), 'Photo URLs must use https://')).max(6).optional(),
  digital_url: z.string().trim().max(500).optional().default(''),
  stock_qty: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  low_stock_at: z.coerce.number().int().min(0).max(1000).optional(),
  is_active: z.boolean().optional().default(true),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;
    const { site } = access;

    const plan = planFor(site.plan_tier, site.plan_expires_at);
    if (plan.maxProducts !== null) {
      const { count } = await supabaseAdmin.from('site_products').select('id', { count: 'exact', head: true }).eq('site_id', site.id);
      if ((count ?? 0) >= plan.maxProducts) {
        return NextResponse.json({ error: `The ${plan.name} plan allows up to ${plan.maxProducts} products. Upgrade to Pro for unlimited products.` }, { status: 403 });
      }
    }

    const raw = await request.json().catch(() => null);
    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid product' }, { status: 400 });
    }

    const urls = Array.from(
      new Set(
        (parsed.data.image_urls ?? (parsed.data.image_url ? [parsed.data.image_url] : []))
          .map((u) => u.trim())
          .filter(Boolean)
      )
    );
    if (urls.length > plan.maxProductPhotos) {
      return NextResponse.json(
        { error: `The ${plan.name} plan allows ${plan.maxProductPhotos} photo per product. Upgrade to Pro to add up to 6 photos.` },
        { status: 403 }
      );
    }

    const baseRow = {
      site_id: site.id,
      title: xss(parsed.data.title),
      description: xss(parsed.data.description),
      category: xss(parsed.data.category || 'General'),
      product_type: parsed.data.product_type,
      price: parsed.data.price,
      compare_at_price: parsed.data.compare_at_price ?? null,
      image_url: xss(urls[0] || ''),
      digital_url: xss(parsed.data.digital_url),
      stock_qty: parsed.data.stock_qty ?? null,
      is_active: parsed.data.is_active,
    };

    const extraRow: Record<string, unknown> = {
      ...baseRow,
      image_urls: urls.map((u) => xss(u)),
      ...(parsed.data.low_stock_at !== undefined ? { low_stock_at: parsed.data.low_stock_at } : {}),
    };

    let { data: product, error } = await supabaseAdmin.from('site_products').insert(extraRow).select('*').single();
    if (isMissingColumnError(error)) {
      if (urls.length > 1) {
        return NextResponse.json({ error: 'Multiple product photos need the latest database update first.' }, { status: 503 });
      }
      const fallback = await supabaseAdmin.from('site_products').insert(baseRow).select('*').single();
      product = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return NextResponse.json({ product }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
