import { supabaseAdmin } from '@/lib/forumServer';
import { siteUrl } from '@/lib/siteUrl';

const xmlEsc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('id, slug, is_public, custom_domain, custom_domain_verified, updated_at')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();

  if (!site || !site.is_public) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }

  const base =
    site.custom_domain && site.custom_domain_verified
      ? `https://${site.custom_domain}`
      : `${siteUrl()}/forums/${site.slug}`;

  const [{ data: products }, { data: threads }] = await Promise.all([
    supabaseAdmin.from('site_products').select('id, updated_at, created_at').eq('site_id', site.id).eq('is_active', true).limit(300),
    supabaseAdmin.from('forum_threads').select('id, last_activity_at').eq('forum_id', site.id).limit(200),
  ]);

  const urls: { loc: string; lastmod?: string }[] = [{ loc: base, lastmod: site.updated_at || undefined }];
  for (const p of products || []) {
    urls.push({ loc: `${base}?product=${encodeURIComponent(p.id)}`, lastmod: p.updated_at || p.created_at || undefined });
  }
  for (const t of threads || []) {
    urls.push({ loc: `${base}?thread=${encodeURIComponent(t.id)}`, lastmod: t.last_activity_at || undefined });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${xmlEsc(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
