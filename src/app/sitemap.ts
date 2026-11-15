import type { MetadataRoute } from 'next';

import { products } from '@/lib/demo/products';

const SITE_URL = 'https://www.iampatterson.com';

/**
 * Phase 10d D4 — sitemap.
 *
 * Includes the canonical user-facing routes that should be crawled +
 * indexed: home, review, contact, ecommerce landing + every product
 * detail page in the catalog.
 *
 * Excludes session-scoped routes that have no value as standalone
 * search-results landing pages: cart, checkout, confirmation,
 * /contact/thanks. Those are also disallowed in `robots.ts`
 * (belt-and-suspenders). `/demo` and `/demo/ecommerce/analytics`
 * were deleted in 17.1 and redirect to the shop, so neither is listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: 'monthly', priority: 1.0 },
    {
      url: `${SITE_URL}/review`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/demo/ecommerce`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      // Claudish translator — a shareable launch surface; canonical is the
      // bare route (share ?t= variants all point their canonical here).
      url: `${SITE_URL}/claudish`,
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
