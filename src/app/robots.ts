import type { MetadataRoute } from 'next';

/**
 * Phase 10d D4 — robots.
 *
 * Allow-by-default with explicit disallow of session-scoped or
 * post-conversion routes that shouldn't appear in search results:
 *   - /demo/ecommerce/cart, /checkout, /confirmation: session-scoped
 *     ecommerce funnel steps. Standalone landing here makes no sense.
 *   - /contact/thanks: post-submission confirmation page; landing here
 *     from search would be a dead-end.
 *
 * The sitemap reference at the bottom signals the canonical crawl
 * surface to crawlers that respect it (Googlebot, Bingbot).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/demo/ecommerce/cart',
          '/demo/ecommerce/checkout',
          '/demo/ecommerce/confirmation',
          '/contact/thanks',
        ],
      },
    ],
    sitemap: 'https://iampatterson.com/sitemap.xml',
  };
}
