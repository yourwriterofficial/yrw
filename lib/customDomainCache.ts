import { createClient } from '@supabase/supabase-js';

const domainCache = new Map<string, { slug: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function lookupCustomDomainSlug(hostHeader: string): Promise<string | null> {
  const host = hostHeader.split(':')[0].toLowerCase().trim();
  if (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.developa.me') ||
    host.endsWith('.developa.local') ||
    host === 'developa.me' ||
    host === 'developa.local' ||
    host.includes('yourresearchwriter') ||
    host.includes('vercel.app')
  ) {
    return null;
  }

  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug;
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data } = await supabase
      .from('forums')
      .select('slug')
      .eq('custom_domain', host)
      .maybeSingle();

    if (data?.slug) {
      domainCache.set(host, { slug: data.slug, expiresAt: Date.now() + CACHE_TTL_MS });
      return data.slug;
    }
  } catch (err) {
    console.warn('Custom domain lookup failed:', err);
  }

  return null;
}
