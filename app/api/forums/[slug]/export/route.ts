import { NextResponse } from 'next/server';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner']);
    if ('error' in access) return access.error;

    const [siteRes, productsRes, variantsRes, couponsRes, ordersRes, threadsRes, subsRes] = await Promise.all([
      supabaseAdmin.from('forums').select('*').eq('id', access.site.id).single(),
      supabaseAdmin.from('site_products').select('*').eq('site_id', access.site.id),
      supabaseAdmin.from('site_product_variants').select('*').eq('site_id', access.site.id),
      supabaseAdmin.from('site_coupons').select('*').eq('site_id', access.site.id),
      supabaseAdmin.from('site_orders').select('*').eq('site_id', access.site.id).order('created_at', { ascending: false }),
      supabaseAdmin.from('forum_threads').select('*').eq('forum_id', access.site.id),
      supabaseAdmin.from('site_subscribers').select('*').eq('site_id', access.site.id),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      version: 1,
      site: siteRes.data,
      products: productsRes.data || [],
      variants: variantsRes.error ? [] : variantsRes.data || [],
      coupons: couponsRes.data || [],
      orders: ordersRes.data || [],
      threads: threadsRes.data || [],
      subscribers: subsRes.error ? [] : subsRes.data || [],
    };

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${access.site.slug}-backup-${today}.json"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export failed' }, { status: 500 });
  }
}
