import { createClient } from '@supabase/supabase-js';
import { planFor } from './plans';

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
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verified domains only: otherwise anyone could claim a domain that points at this server.
    let { data } = await supabase
      .from('forums')
      .select('slug, custom_domain_verified, plan_tier, plan_expires_at')
      .eq('custom_domain', host)
      .eq('custom_domain_verified', true)
      .maybeSingle();

    if (!data) {
      // Before the plan-expiry column exists, fall back to the columns that do.
      const retry = await supabase
        .from('forums')
        .select('slug, custom_domain_verified, plan_tier')
        .eq('custom_domain', host)
        .eq('custom_domain_verified', true)
        .maybeSingle();
      data = retry.data as typeof data;
    }

    // A custom domain is a paid feature; a lapsed plan stops it routing.
    if (data && !planFor(data.plan_tier, (data as { plan_expires_at?: string | null }).plan_expires_at).customDomain) {
      data = null;
    }

    if (data?.slug) {
      domainCache.set(host, { slug: data.slug, expiresAt: Date.now() + CACHE_TTL_MS });
      return data.slug;
    }
  } catch (err) {
    console.warn('Custom domain lookup failed:', err);
  }

  return null;
}
