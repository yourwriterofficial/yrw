import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';
import { supabaseAdmin } from '@/lib/forumServer';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const routes = [
    '',
    '/projects',
    '/developer',
    '/forums',
    '/create',
    '/login',
    '/register',
  ];

  const entries: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '' || path === '/forums' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));

  try {
    const { data: forums } = await supabaseAdmin
      .from('forums')
      .select('slug, created_at')
      .eq('is_public', true)
      .limit(500);

    for (const f of forums || []) {
      entries.push({
        url: `${base}/forums/${encodeURIComponent(f.slug)}`,
        lastModified: f.created_at ? new Date(f.created_at) : now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    // Keep base static routes if DB is unavailable
  }

  return entries;
}
