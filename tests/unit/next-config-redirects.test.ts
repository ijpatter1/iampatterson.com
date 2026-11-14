/**
 * Phase 9E D7 redirect config coverage.
 *
 * Imports `next.config.mjs` and validates the shape of the async
 * `redirects()` return value. Catches regressions like `permanent: true`
 * being silently flipped to default-302 behavior, or a deep-link glob
 * being dropped, which `next build` schema validation alone wouldn't
 * surface until an external link 404'd in production.
 */
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

  // 15.4 deleted the Demos section and its rebuild banner, so `#demos` and
  // `?rebuild=` would point at nothing. No demo redirect may carry either.
  it('sends no demo redirect to the deleted Demos section or its rebuild banner', async () => {
    const redirects = await nextConfig.redirects?.();
    for (const r of redirects!) {
      expect(r.destination).not.toMatch(/#demos|rebuild=/);
    }
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
