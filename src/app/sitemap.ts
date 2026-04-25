import type { MetadataRoute } from 'next';

import { products } from '@/lib/demo/products';

const SITE_URL = 'https://iampatterson.com';

/**
 * Phase 10d D4 — sitemap.
 *
 * Includes the canonical user-facing routes that should be crawled +
 * indexed: home, services, about, contact, demo entry, ecommerce
 * landing + every product detail page in the catalog.
 *
 * Excludes session-scoped routes that have no value as standalone
 * search-results landing pages: cart, checkout, confirmation,
 * /contact/thanks. Those are also disallowed in `robots.ts`
 * (belt-and-suspenders). The `/demo/ecommerce/analytics` route is
 * also omitted — it's a Tier-3 internal-data view that depends on
 * session state and doesn't deep-link cleanly from search.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: 'monthly', priority: 1.0 },
    {
      url: `${SITE_URL}/services`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/demo/ecommerce`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/demo/ecommerce/${p.id}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.4,
  }));

  return [...staticEntries, ...productEntries];
}
