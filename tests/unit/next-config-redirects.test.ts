/**
 * Phase 9E D7 redirect config coverage.
 *
 * Imports `next.config.mjs` and validates the shape of the async
 * `redirects()` return value. Catches regressions like `permanent: true`
 * being silently flipped to default-302 behavior, or a deep-link glob
 * being dropped, which `next build` schema validation alone wouldn't
 * surface until an external link 404'd in production.
 */
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';

import nextConfig from '../../next.config.mjs';

describe('next.config.mjs redirects (Phase 9E D7)', () => {
  // 16.2: the about page folds into /contact. Old links (LinkedIn, search)
  // must land on the merged page, permanently, so search engines move the
  // index entry rather than keep a dead URL.
  it('redirects `/about` permanently to `/contact`', async () => {
    const redirects = await nextConfig.redirects?.();
    const about = redirects!.find((r) => r.source === '/about');
    expect(about).toEqual(
      expect.objectContaining({ source: '/about', destination: '/contact', permanent: true }),
    );
  });

  // 16.1 deleted the services page. Old links land on the homepage, which
  // now carries the offer, permanently so search engines drop the old URL.
  it('redirects `/services` permanently to `/`', async () => {
    const redirects = await nextConfig.redirects?.();
    const services = redirects!.find((r) => r.source === '/services');
    expect(services).toEqual(
      expect.objectContaining({ source: '/services', destination: '/', permanent: true }),
    );
  });

  // 15.4 deleted the Demos section and its rebuild banner, so `#demos` and
  // `?rebuild=` would point at nothing. No demo redirect may carry either.
  it('sends no demo redirect to the deleted Demos section or its rebuild banner', async () => {
    const redirects = await nextConfig.redirects?.();
    for (const r of redirects!) {
      expect(r.destination).not.toMatch(/#demos|rebuild=/);
    }
  });

  // 17.1 deleted the demo catalog and the shop's dashboard page. The shop
  // itself stays, so both old URLs land on it, permanently, so search engines
  // move the index entry to the shop instead of keeping a dead URL.
  it.each(['/demo', '/demo/ecommerce/analytics'])(
    'redirects `%s` permanently to the shop (17.1)',
    async (source) => {
      const redirects = await nextConfig.redirects?.();
      const rules = redirects!.filter((r) => r.source === source);
      expect(rules).toEqual([
        expect.objectContaining({ source, destination: '/demo/ecommerce', permanent: true }),
      ]);
    },
  );

  // The catalog rule must match the bare `/demo` only. A `:path*` on it would
  // also catch the shop's own pages and send every visitor in a loop back to
  // the shop's front page, so no shop step could be reached. Matched with
  // Next's own path matcher, so the check is what the router does.
  it.each([
    '/demo/ecommerce',
    '/demo/ecommerce/tuna-plush-classic',
    '/demo/ecommerce/cart',
    '/demo/ecommerce/checkout',
    '/demo/ecommerce/confirmation',
  ])('redirects no visitor away from the shop page %s (17.1)', async (shopPath) => {
    const redirects = await nextConfig.redirects?.();
    const caught = redirects!.filter((r) => getPathMatch(r.source, { strict: true })(shopPath));
    expect(caught).toEqual([]);
  });

  it('exports an async redirects() function', () => {
    expect(typeof nextConfig.redirects).toBe('function');
  });

  // One `:path*` rule per demo: in Next.js `:path*` matches zero or more
  // segments, so the one rule covers the bare URL and every deep link.
  it.each(['subscription', 'leadgen'])(
    'redirects `/demo/%s` and every deep link to the homepage with one rule (15.4)',
    async (demo) => {
      const redirects = await nextConfig.redirects?.();
      const rules = redirects!.filter((r) => r.source.startsWith(`/demo/${demo}`));
      expect(rules).toEqual([
        expect.objectContaining({
          source: `/demo/${demo}/:path*`,
          destination: '/',
          permanent: true,
        }),
      ]);
    },
  );

  it('all D7 redirects are permanent (so search engines update their index)', async () => {
    // Guard against a future edit that adds a demo-removal redirect
    // without `permanent: true`, Next.js defaults to 302, which
    // search engines treat as temporary and don't re-index.
    const redirects = await nextConfig.redirects?.();
    const demoRedirects = redirects!.filter(
      (r) => r.source.startsWith('/demo/subscription') || r.source.startsWith('/demo/leadgen'),
    );
    expect(demoRedirects).toHaveLength(2);
    expect(demoRedirects.every((r) => r.permanent === true)).toBe(true);
  });
});
