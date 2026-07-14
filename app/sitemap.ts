import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  const routes = [
    '',
    '/projects',
    '/academic-writing',
    '/content-writing',
    '/resume-cv',
    '/statistics-fieldwork',
    '/developer',
    '/order/academic',
    '/order/content',
    '/order/dev',
    '/order/resume',
    '/order/statistics',
    '/login',
    '/register',
  ];

  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));
}
