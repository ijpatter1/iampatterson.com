'use client';

import { CartProvider } from '@/components/demo/ecommerce/cart-context';
import { EcomDemoBanner } from '@/components/demo/ecommerce/ecom-demo-banner';
import { EcomFooter } from '@/components/demo/ecommerce/ecom-footer';
import { EcomSubNav } from '@/components/demo/ecommerce/ecom-sub-nav';

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  // `data-demo="ecommerce"` scopes the Tuna Shop palette override in
  // `src/styles/globals.css`. The shop's terracotta `--accent` replaces the
  // site-wide persimmon inside this subtree only, terminal surfaces pick
  // up the warm Tuna palette, and the subtree gets a cream page background
  // so product cards breathe on cream rather than the site's white surface.
  // See docs/REQUIREMENTS.md Phase 9F deliverable 12 + docs/ARCHITECTURE.md
  // "Brand treatment".
  //
  // Stacking order inside the demo surface (top → bottom):
  //   1. EcomDemoBanner, terminal-styled "this is a demo" top strip
  //      (UAT r2 item 7, previously only lived in the footer).
  //   2. EcomSubNav, Tuna Shop wordmark + `shop · cart` wayfinding.
  //   3. Page content.
  //   4. EcomFooter, mission paragraph + back-to-site links.
  //
  // All four are distinct from the session-scoped site chrome
  // (SessionPulse + LiveStrip + HomeBar) which renders above them.
  return (
    <div data-demo="ecommerce" className="flex min-h-screen flex-col">
      <CartProvider>
        <EcomDemoBanner />
        <EcomSubNav />
        <div className="flex-1">{children}</div>
        <EcomFooter />
      </CartProvider>
    </div>
  );
}
