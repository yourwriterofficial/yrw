import { NextResponse } from 'next/server';
import { extractDevelopaSubdomain } from '@/lib/forums';
import { supabaseAdmin } from '@/lib/forumServer';

const FALLBACK_ACCENT = '#4f46e5';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('slug, name, accent_color, logo_url, is_public, custom_domain, custom_domain_verified')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();

  if (!site || !site.is_public) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const accent = /^#[0-9a-f]{3,8}$/i.test(site.accent_color || '') ? (site.accent_color as string) : FALLBACK_ACCENT;
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(':')[0].toLowerCase();
  const ownHost =
    extractDevelopaSubdomain(host) === site.slug ||
    (site.custom_domain_verified === true && !!site.custom_domain && site.custom_domain.toLowerCase() === host);
  const base = ownHost ? '/' : `/forums/${site.slug}`;

  const logo = typeof site.logo_url === 'string' && site.logo_url.startsWith('https://') ? site.logo_url : '';
  const icons = [
    logo
      ? { src: logo, sizes: '512x512', purpose: 'any' }
      : { src: `/api/forums/${site.slug}/icon`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
  ];

  const manifest = {
    name: site.name,
    short_name: String(site.name).slice(0, 12),
    start_url: base,
    scope: base,
    display: 'standalone',
    theme_color: accent,
    background_color: accent,
    icons,
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
