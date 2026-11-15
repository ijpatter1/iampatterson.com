/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev only: Next 16 blocks cross-origin requests to /_next/* from any host but localhost, so a phone
  // on the LAN got the page HTML and a 403 for every chunk. Ignored by production builds.
  allowedDevOrigins: ['192.168.86.*'],
  async redirects() {
    // Phase 9E deliverable 7 removed the subscription and leadgen demos; 308
    // permanent redirects catch old LinkedIn links, handoff references and
    // search-indexed URLs. 15.4 deleted the homepage's Demos section and its
    // rebuild banner, so they now land on the homepage itself.
    return [
      // 16.2: the about page folds into /contact.
      { source: '/about', destination: '/contact', permanent: true },
      // 16.1: the services page is deleted; the homepage carries the offer.
      { source: '/services', destination: '/', permanent: true },
      // `:path*` matches zero or more segments, so each rule covers the bare
      // URL too.
      { source: '/demo/subscription/:path*', destination: '/', permanent: true },
      { source: '/demo/leadgen/:path*', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
