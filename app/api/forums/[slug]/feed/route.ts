import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/forumServer';
import { pluginOn } from '@/lib/plugins';
import { readPluginSettings } from '@/lib/pluginsServer';

export const dynamic = 'force-dynamic';

function escXml(v: string): string {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const format = new URL(request.url).searchParams.get('format') || 'json';

  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('id, slug, name, description, currency, plan_tier, plan_expires_at, is_public, custom_domain, custom_domain_verified')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();

  if (!site || !site.is_public) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Catalog feeds are fetched by Google/Meta, so links must be the store's own public address.
  const base =
    site.custom_domain && site.custom_domain_verified
      ? `https://${site.custom_domain}`
      : `https://${site.slug}.developa.me`;
  const { data: products, error: productsError } = await supabaseAdmin
    .from('site_products')
    .select('id, title, description, price, image_url, stock_qty, category, updated_at')
    .eq('site_id', site.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(100);

  if (productsError) {
    console.error('feed products query failed', productsError.message);
    return NextResponse.json({ error: 'Could not load products' }, { status: 500 });
  }
  const items = products || [];

  if (format === 'xml') {
    const settings = await readPluginSettings(site.id);
    if (!pluginOn('catalog_feed', site.plan_tier, site.plan_expires_at, settings)) {
      return NextResponse.json({ error: 'Google/Meta Catalog XML feed requires a paid plan.' }, { status: 403 });
    }
    const xmlItems = items
      .map((p) => {
        const link = `${base}?product=${encodeURIComponent(p.id)}`;
        const avail = p.stock_qty === null || p.stock_qty > 0 ? 'in stock' : 'out of stock';
        return `<item>
  <g:id>${escXml(p.id)}</g:id>
  <g:title>${escXml(p.title)}</g:title>
  <g:description>${escXml(p.description || p.title)}</g:description>
  <g:link>${escXml(link)}</g:link>
  ${p.image_url ? `<g:image_link>${escXml(p.image_url)}</g:image_link>` : ''}
  <g:availability>${avail}</g:availability>
  <g:price>${Number(p.price).toFixed(2)} ${escXml(site.currency || 'NGN')}</g:price>
  <g:condition>new</g:condition>
</item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>${escXml(site.name)}</title>
  <link>${escXml(base)}</link>
  <description>${escXml(site.description || site.name)}</description>
  ${xmlItems}
</channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }

  if (format === 'rss') {
    const rssItems = items
      .map(
        (p) => `<item>
  <title>${escXml(p.title)}</title>
  <link>${escXml(`${base}?product=${encodeURIComponent(p.id)}`)}</link>
  <description>${escXml(p.description || `${p.title} - ${p.price} ${site.currency || 'NGN'}`)}</description>
  <guid>${escXml(p.id)}</guid>
</item>`
      )
      .join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${escXml(site.name)}</title>
  <link>${escXml(base)}</link>
  <description>${escXml(site.description || site.name)}</description>
  ${rssItems}
</channel></rss>`;

    return new NextResponse(rss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }

  return NextResponse.json(
    {
      site: { slug: site.slug, name: site.name, url: base, currency: site.currency || 'NGN' },
      products: items.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category,
        url: `${base}?product=${encodeURIComponent(p.id)}`,
      })),
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    }
  );
}
