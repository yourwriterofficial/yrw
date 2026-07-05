import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep private / authenticated areas out of the index.
        disallow: ['/admin', '/dashboard', '/api', '/invoice/', '/complete-registration', '/update-password'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
