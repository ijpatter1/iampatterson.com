/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Phase 9E deliverable 7: subscription + leadgen demos removed from the
    // site pending rebuild to the native-reveal pattern language (Phase 9F
    // establishes the pattern). 301 permanent redirects catch old LinkedIn
    // links, session handoff references, and search-indexed URLs. The
    // `:path*` glob catches deep links into child routes (e.g.
    // /demo/subscription/account) so no child path 404s. The `rebuild`
    // query param signals the Demos section to surface a one-line honesty
    // banner explaining the rebuild-in-progress status.
    //
    // Spec: UX_PIVOT_SPEC §3.7 + §4; REQUIREMENTS Phase 9E D7 line 366.
    // permanent: true → 308 via Next.js (some CDNs rewrite to 301); either
    // way, the redirect is cacheable and signals to search engines to
    // update their index.
    return [
      {
        source: '/demo/subscription/:path*',
        destination: '/?rebuild=subscription#demos',
        permanent: true,
      },
      {
        source: '/demo/subscription',
        destination: '/?rebuild=subscription#demos',
        permanent: true,
      },
      {
        source: '/demo/leadgen/:path*',
        destination: '/?rebuild=leadgen#demos',
        permanent: true,
      },
      {
        source: '/demo/leadgen',
        destination: '/?rebuild=leadgen#demos',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
