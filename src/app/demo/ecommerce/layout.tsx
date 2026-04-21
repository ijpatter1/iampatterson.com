'use client';

import { CartProvider } from '@/components/demo/ecommerce/cart-context';
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
  // EcomSubNav renders the Tuna Shop wordmark + `shop · cart` wayfinding
  // at the top; EcomFooter renders the "this is a demo / no-kill rescues"
  // brand beat + back-to-site links at the bottom. Both are distinct from
  // the session-scoped site chrome (SessionPulse + LiveStrip + HomeBar).
  return (
    <div data-demo="ecommerce" className="flex min-h-screen flex-col">
      <CartProvider>
        <EcomSubNav />
        <div className="flex-1">{children}</div>
        <EcomFooter />
      </CartProvider>
    </div>
  );
}
