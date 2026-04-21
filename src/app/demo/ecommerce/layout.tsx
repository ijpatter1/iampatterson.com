'use client';

import { CartProvider } from '@/components/demo/ecommerce/cart-context';

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  // `data-demo="ecommerce"` scopes the Tuna Shop palette override in
  // `src/styles/globals.css`. The shop's terracotta `--accent` replaces the
  // site-wide persimmon inside this subtree only, and terminal surfaces
  // (toast / sidebar / inline / full-page diagnostic) pick up the warm Tuna
  // palette rather than the site-wide phosphor amber. See docs/REQUIREMENTS.md
  // Phase 9F deliverable 12 + docs/ARCHITECTURE.md "Brand treatment".
  return (
    <div data-demo="ecommerce" className="ecommerce-demo-scope">
      <CartProvider>{children}</CartProvider>
    </div>
  );
}
