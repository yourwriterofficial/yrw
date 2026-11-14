import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/forumServer';

const FALLBACK_ACCENT = '#4f46e5';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('name, accent_color, is_public')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();

  if (!site || !site.is_public) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const accent = /^#[0-9a-f]{3,8}$/i.test(site.accent_color || '') ? (site.accent_color as string) : FALLBACK_ACCENT;
  const letter = (Array.from(String(site.name).trim())[0] || 'D').toUpperCase().replace(/[&<>"']/g, '');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" fill="${accent}"/>` +
    `<text x="256" y="256" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="280" font-weight="700" fill="#ffffff">${letter}</text>` +
    `</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
