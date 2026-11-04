/**
 * Phase 10d D4 — SEO test pins.
 *
 * Asserts: per-route metadata + Open Graph + Twitter card shape; root
 * layout `metadataBase` + JSON-LD presence; sitemap inclusions /
 * exclusions; robots disallow set for non-canonical routes.
 */
import type { Metadata, MetadataRoute } from 'next';

describe('Phase 10d D4 — SEO', () => {
  describe('Root layout metadata', () => {
    it('exports metadataBase set to the canonical site origin', async () => {
      const mod = await import('@/app/layout');
      const metadata = (mod as unknown as { metadata: Metadata }).metadata;
      expect(metadata.metadataBase).toBeDefined();
      expect(metadata.metadataBase?.toString()).toBe('https://iampatterson.com/');
    });

    it('exports openGraph with site_name + locale + type=website', async () => {
      const mod = await import('@/app/layout');
      const metadata = (mod as unknown as { metadata: Metadata }).metadata;
      expect(metadata.openGraph).toBeDefined();
      const og = metadata.openGraph as { siteName?: string; locale?: string; type?: string };
      expect(og.siteName).toBe('I am Patterson');
      expect(og.locale).toBe('en_US');
      expect(og.type).toBe('website');
    });

    // The practice is I am Patterson, and the page says what the LinkedIn
    // headline says, so search results and link previews match the profile.
    it('names the practice I am Patterson and describes it in the profile headline', async () => {
      const mod = await import('@/app/layout');
      const metadata = (mod as unknown as { metadata: Metadata }).metadata;
      const headline =
        'I lead marketing data, measurement and AI work for in-house marketing teams, from tracking reviews to fractional leadership.';
      expect(metadata.title).toEqual({
        default: 'I am Patterson · Marketing data, measurement and AI',
        template: '%s | I am Patterson',
      });
      expect(metadata.description).toBe(headline);
      expect((metadata.openGraph as { description?: string }).description).toBe(headline);
      expect(JSON.stringify(metadata)).not.toMatch(
        /Patterson Consulting|measurement infrastructure/i,
      );
    });

    it('exports twitter card with summary_large_image', async () => {
      const mod = await import('@/app/layout');
      const metadata = (mod as unknown as { metadata: Metadata }).metadata;
      expect(metadata.twitter).toBeDefined();
      const tw = metadata.twitter as { card?: string };
      expect(tw.card).toBe('summary_large_image');
    });
  });

  describe('Per-route layout metadata', () => {
    const routes = [
      { path: '@/app/services/layout', name: 'services' },
      { path: '@/app/contact/layout', name: 'contact' },
      { path: '@/app/review/layout', name: 'review' },
      { path: '@/app/demo/ecommerce/layout', name: 'ecommerce demo' },
    ];

    for (const r of routes) {
      it(`${r.name} layout exports openGraph title + description`, async () => {
        const mod = await import(/* webpackIgnore: true */ r.path);
        const metadata = (mod as unknown as { metadata: Metadata }).metadata;
        expect(metadata.openGraph).toBeDefined();
        const og = metadata.openGraph as { title?: string; description?: string };
        expect(og.title).toBeTruthy();
        expect(og.description).toBeTruthy();
      });
    }
  });

  describe('JSON-LD structured data', () => {
    it('exposes Organization JSON-LD via @/lib/seo/json-ld', async () => {
      const mod = await import('@/lib/seo/json-ld');
      const org = (
        mod as { organizationJsonLd: () => Record<string, unknown> }
      ).organizationJsonLd();
      expect(org['@context']).toBe('https://schema.org');
      expect(org['@type']).toBe('Organization');
      expect(org.name).toBe('I am Patterson');
      expect(org.url).toBe('https://iampatterson.com');
      // Founder must be a real Person sub-object, not just truthy.
      // A future edit that flips `founder` to a bare string or `{}`
      // would pass `toBeDefined` but break Google's Knowledge Graph
      // resolution — pin both the @type and the name.
      const founder = org.founder as Record<string, unknown>;
      expect(founder).toBeDefined();
      expect(founder['@type']).toBe('Person');
      expect(founder.name).toBe('Ian Patterson');
    });

    // Search results, link previews and the Knowledge Graph say the same
    // thing because they read one constant.
    it('gives the Organization JSON-LD the same description as the page metadata', async () => {
      const layout = await import('@/app/layout');
      const metadata = (layout as unknown as { metadata: Metadata }).metadata;
      const mod = await import('@/lib/seo/json-ld');
      const org = (
        mod as { organizationJsonLd: () => Record<string, unknown> }
      ).organizationJsonLd();
      expect(org.description).toBe(metadata.description);
      const site = await import('@/lib/seo/site');
      expect(metadata.description).toBe(site.SITE_DESCRIPTION);
    });

    it('exposes Person JSON-LD via @/lib/seo/json-ld', async () => {
      const mod = await import('@/lib/seo/json-ld');
      const person = (mod as { personJsonLd: () => Record<string, unknown> }).personJsonLd();
      expect(person['@context']).toBe('https://schema.org');
      expect(person['@type']).toBe('Person');
      expect(person.name).toBe('Ian Patterson');
      expect(person.url).toBe('https://iampatterson.com');
      expect(person.jobTitle).toBeTruthy();
      expect(JSON.stringify(person)).not.toMatch(
        /Patterson Consulting|measurement infrastructure/i,
      );
    });
  });

  // The price lives in one constant, so the review page's search snippet and
  // share card cannot go stale when it changes.
  describe('Review page metadata', () => {
    it('takes its price from the single constant', async () => {
      const { metadata } = (await import('@/app/review/layout')) as unknown as {
        metadata: Metadata;
      };
      const { REVIEW_PRICE } = await import('@/lib/content/review');
      expect(metadata.description).toContain(`From ${REVIEW_PRICE}.`);
    });
  });

  describe('Sitemap', () => {
    it('includes canonical pages and excludes non-canonical (cart/checkout/confirmation/thanks)', async () => {
      const sitemap = (await import('@/app/sitemap')).default;
      const entries = (sitemap as () => MetadataRoute.Sitemap)();
      const urls = entries.map((e) => e.url);

      // Canonical static inclusions (`/about` left with 16.2, which folds
      // it into `/contact`). Tightened
      // beyond `arrayContaining` so a future drop of e.g. `/demo`
      // can't silently slip past the test (mirrors the product-URL
      // tightness fix-pack applied at line 111-114 below).
      const expectedStatic = [
        'https://iampatterson.com',
        'https://iampatterson.com/services',
        'https://iampatterson.com/contact',
        'https://iampatterson.com/review',
        'https://iampatterson.com/demo',
        'https://iampatterson.com/demo/ecommerce',
        'https://iampatterson.com/claudish',
      ];
      const staticUrls = urls.filter((u) => !/\/demo\/ecommerce\/[a-z0-9-]+$/.test(u));
      expect(staticUrls.length).toBe(expectedStatic.length);
      for (const u of expectedStatic) {
        expect(urls).toContain(u);
      }

      // Product detail pages — every catalog product must be present
      // (subset-invariant `>= 1` would let the sitemap silently drop
      // products if `products.ts` regresses or the iterator truncates).
      const { products } = await import('@/lib/demo/products');
      const productUrls = urls.filter((u) => /\/demo\/ecommerce\/[a-z0-9-]+$/.test(u));
      expect(productUrls.length).toBe(products.length);
      for (const p of products) {
        expect(urls).toContain(`https://iampatterson.com/demo/ecommerce/${p.id}`);
      }

      // Non-canonical exclusions
      expect(urls).not.toContain('https://iampatterson.com/demo/ecommerce/cart');
      expect(urls).not.toContain('https://iampatterson.com/demo/ecommerce/checkout');
      expect(urls).not.toContain('https://iampatterson.com/demo/ecommerce/confirmation');
      expect(urls).not.toContain('https://iampatterson.com/contact/thanks');
    });
  });

  describe('Robots', () => {
    it('disallows non-canonical routes from indexing', async () => {
      const robots = (await import('@/app/robots')).default;
      const result = (robots as () => MetadataRoute.Robots)();
      const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
      // Flatten the disallow list across all rule entries.
      const disallow = rules.flatMap((r) =>
        r && 'disallow' in r ? (Array.isArray(r.disallow) ? r.disallow : [r.disallow!]) : [],
      );
      expect(disallow).toEqual(
        expect.arrayContaining([
          '/demo/ecommerce/cart',
          '/demo/ecommerce/checkout',
          '/demo/ecommerce/confirmation',
          '/contact/thanks',
        ]),
      );
    });

    it('exposes the sitemap URL', async () => {
      const robots = (await import('@/app/robots')).default;
      const result = (robots as () => MetadataRoute.Robots)();
      expect(result.sitemap).toBe('https://iampatterson.com/sitemap.xml');
    });
  });
});
