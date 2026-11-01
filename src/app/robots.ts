import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  const b = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/invoices', '/import', '/activity', '/billing', '/settings', '/help', '/onboarding', '/api/', '/auth/'] }], sitemap: `${b}/sitemap.xml` };
}
