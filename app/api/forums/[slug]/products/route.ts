import { planFor } from '@/lib/plans';
import { readExtendedSite } from '@/lib/forumServer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';

const productSchema = z.object({
  title: z.string().trim().min(2, 'Product title is required').max(120),
  description: z.string().trim().max(1500).optional().default(''),
  category: z.string().trim().max(50).optional().default('General'),
  product_type: z.enum(['physical', 'digital', 'service']).optional().default('physical'),
  price: z.coerce.number().min(0, 'Price cannot be negative').max(100_000_000),
  compare_at_price: z.union([z.coerce.number().min(0), z.null()]).optional(),
  image_url: z.string().trim().max(500).optional().default(''),
  digital_url: z.string().trim().max(500).optional().default(''),
  stock_qty: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  is_active: z.boolean().optional().default(true),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, owner_id, plan_tier')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (site.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // The Starter plan has a product limit; Pro and Business are unlimited.
    const plan = planFor((site as { plan_tier?: string }).plan_tier, (await readExtendedSite(site.id))?.plan_expires_at);
    if (plan.maxProducts !== null) {
      const { count } = await supabaseAdmin.from('site_products').select('id', { count: 'exact', head: true }).eq('site_id', site.id);
      if ((count ?? 0) >= plan.maxProducts) {
        return NextResponse.json({ error: `The ${plan.name} plan allows up to ${plan.maxProducts} products. Upgrade to Pro for unlimited products.` }, { status: 403 });
      }
    }

    const raw = await request.json();
    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid product' }, { status: 400 });
    }

    const { data: product, error } = await supabaseAdmin
      .from('site_products')
      .insert({
        site_id: site.id,
        title: xss(parsed.data.title),
        description: xss(parsed.data.description),
        category: xss(parsed.data.category || 'General'),
        product_type: parsed.data.product_type,
        price: parsed.data.price,
        compare_at_price: parsed.data.compare_at_price ?? null,
        image_url: xss(parsed.data.image_url),
        digital_url: xss(parsed.data.digital_url),
        stock_qty: parsed.data.stock_qty ?? null,
        is_active: parsed.data.is_active,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ product }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
