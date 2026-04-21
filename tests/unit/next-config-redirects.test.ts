/**
 * Phase 9E D7 redirect config coverage.
 *
 * Imports `next.config.mjs` and validates the shape of the async
 * `redirects()` return value. Catches regressions like `permanent: true`
 * being silently flipped to default-302 behavior, or a deep-link glob
 * being dropped, which `next build` schema validation alone wouldn't
 * surface until an external link 404'd in production.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import nextConfig from '../../next.config.mjs';

describe('next.config.mjs redirects (Phase 9E D7)', () => {
  it('exports an async redirects() function', () => {
    expect(typeof nextConfig.redirects).toBe('function');
  });

  it('redirects `/demo/subscription` and deep-link children to /?rebuild=subscription#demos', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toBeDefined();
    const subs = redirects!.filter((r) => r.source.startsWith('/demo/subscription'));
    // Both the bare path and the `:path*` glob must be listed so the
    // bare URL doesn't 404 past the glob.
    expect(subs.length).toBeGreaterThanOrEqual(2);
    for (const redirect of subs) {
      expect(redirect.destination).toBe('/?rebuild=subscription#demos');
      expect(redirect.permanent).toBe(true);
    }
    expect(subs.map((r) => r.source)).toEqual(
      expect.arrayContaining(['/demo/subscription', '/demo/subscription/:path*']),
    );
  });

  it('redirects `/demo/leadgen` and deep-link children to /?rebuild=leadgen#demos', async () => {
    const redirects = await nextConfig.redirects?.();
    const leads = redirects!.filter((r) => r.source.startsWith('/demo/leadgen'));
    expect(leads.length).toBeGreaterThanOrEqual(2);
    for (const redirect of leads) {
      expect(redirect.destination).toBe('/?rebuild=leadgen#demos');
      expect(redirect.permanent).toBe(true);
    }
    expect(leads.map((r) => r.source)).toEqual(
      expect.arrayContaining(['/demo/leadgen', '/demo/leadgen/:path*']),
    );
  });

  it('all D7 redirects are permanent (so search engines update their index)', async () => {
    // Guard against a future edit that adds a demo-removal redirect
    // without `permanent: true`, Next.js defaults to 302, which
    // search engines treat as temporary and don't re-index.
    const redirects = await nextConfig.redirects?.();
    const demoRedirects = redirects!.filter(
      (r) => r.source.startsWith('/demo/subscription') || r.source.startsWith('/demo/leadgen'),
    );
    expect(demoRedirects.length).toBeGreaterThanOrEqual(4);
    expect(demoRedirects.every((r) => r.permanent === true)).toBe(true);
  });
});
