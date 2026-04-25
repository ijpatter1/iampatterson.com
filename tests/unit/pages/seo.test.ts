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
      expect(og.siteName).toBe('Patterson Consulting');
      expect(og.locale).toBe('en_US');
      expect(og.type).toBe('website');
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
      { path: '@/app/about/layout', name: 'about' },
      { path: '@/app/contact/layout', name: 'contact' },
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
      expect(org.name).toBe('Patterson Consulting');
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

    it('exposes Person JSON-LD via @/lib/seo/json-ld', async () => {
      const mod = await import('@/lib/seo/json-ld');
      const person = (mod as { personJsonLd: () => Record<string, unknown> }).personJsonLd();
      expect(person['@context']).toBe('https://schema.org');
      expect(person['@type']).toBe('Person');
      expect(person.name).toBe('Ian Patterson');
      expect(person.url).toBe('https://iampatterson.com');
      expect(person.jobTitle).toBeTruthy();
    });
  });

  describe('Sitemap', () => {
    it('includes canonical pages and excludes non-canonical (cart/checkout/confirmation/thanks)', async () => {
      const sitemap = (await import('@/app/sitemap')).default;
      const entries = (sitemap as () => MetadataRoute.Sitemap)();
      const urls = entries.map((e) => e.url);

      // Canonical inclusions
      expect(urls).toEqual(
        expect.arrayContaining([
          'https://iampatterson.com',
          'https://iampatterson.com/services',
          'https://iampatterson.com/about',
          'https://iampatterson.com/contact',
          'https://iampatterson.com/demo/ecommerce',
        ]),
      );

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
