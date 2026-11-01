import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const b = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return ['', '/pricing', '/login', '/signup', '/privacy', '/terms', '/contact'].map(p => ({ url: b + p, changeFrequency: 'monthly' as const, priority: p === '' ? 1 : 0.6 }));
}
