import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/forums', '/forums/', '/developer'],
        disallow: ['/api/', '/developer/manage', '/admin', '/receipt/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
