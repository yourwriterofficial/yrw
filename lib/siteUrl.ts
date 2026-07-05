/**
 * Canonical site origin for SEO (sitemap, robots, OG, canonical URLs).
 * Prefers the explicit env var; falls back to the Vercel production URL, then
 * the known domain. NEXT_PUBLIC_BASE_URL is localhost in dev — filter that out
 * for SEO purposes so we never emit localhost URLs into a sitemap.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (base && !base.includes('localhost') && !base.includes('127.0.0.1')) {
    return base.replace(/\/$/, '');
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return 'https://yourresearchwriter.com.ng';
}
