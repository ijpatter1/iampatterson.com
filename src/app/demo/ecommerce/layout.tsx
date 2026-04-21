'use client';

import { CartProvider } from '@/components/demo/ecommerce/cart-context';
import { EcomSubNav } from '@/components/demo/ecommerce/ecom-sub-nav';

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  // `data-demo="ecommerce"` scopes the Tuna Shop palette override in
  // `src/styles/globals.css`. The shop's terracotta `--accent` replaces the
  // site-wide persimmon inside this subtree only, and terminal surfaces
  // (toast / sidebar / inline / full-page diagnostic) pick up the warm Tuna
  // palette rather than the site-wide phosphor amber. See docs/REQUIREMENTS.md
  // Phase 9F deliverable 12 + docs/ARCHITECTURE.md "Brand treatment".
  //
  // EcomSubNav (Phase 9F follow-up, 2026-04-21) renders the demo's own
  // `shop · cart` wayfinding below the site chrome. This is distinct from
  // the session-scoped SessionPulse nav; the demo has its own shop-scoped
  // navigation inside the demo subtree.
  return (
    <div data-demo="ecommerce" className="ecommerce-demo-scope">
      <CartProvider>
        <EcomSubNav />
        {children}
      </CartProvider>
    </div>
  );
}
