import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';

const updateProductSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1500).optional(),
  category: z.string().trim().max(50).optional(),
  product_type: z.enum(['physical', 'digital', 'service']).optional(),
  price: z.coerce.number().min(0).max(100_000_000).optional(),
  compare_at_price: z.union([z.coerce.number().min(0), z.null()]).optional(),
  image_url: z.string().trim().max(500).optional(),
  digital_url: z.string().trim().max(500).optional(),
  stock_qty: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  is_active: z.boolean().optional(),
});

async function verifyOwner(slug: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('id, owner_id')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();

  if (!site) return { error: NextResponse.json({ error: 'Store not found' }, { status: 404 }) };
  if (site.owner_id !== user.id) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { site };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; productId: string }> }
) {
  try {
    const { slug, productId } = await context.params;
    const auth = await verifyOwner(slug);
    if ('error' in auth) return auth.error;

    const raw = await request.json();
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
    if (parsed.data.image_url !== undefined) updates.image_url = xss(parsed.data.image_url);
    if (parsed.data.digital_url !== undefined) updates.digital_url = xss(parsed.data.digital_url);
    if (parsed.data.stock_qty !== undefined) updates.stock_qty = parsed.data.stock_qty;
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

    const { data: product, error } = await supabaseAdmin
      .from('site_products')
      .update(updates)
      .eq('id', productId)
      .eq('site_id', auth.site.id)
      .select('*')
      .single();

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
    const auth = await verifyOwner(slug);
    if ('error' in auth) return auth.error;

    const { error } = await supabaseAdmin
      .from('site_products')
      .delete()
      .eq('id', productId)
      .eq('site_id', auth.site.id);

    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
