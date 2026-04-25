'use client';

import { CartProvider } from '@/components/demo/ecommerce/cart-context';
import { EcomDemoBanner } from '@/components/demo/ecommerce/ecom-demo-banner';
import { EcomFooter } from '@/components/demo/ecommerce/ecom-footer';
import { EcomSubNav } from '@/components/demo/ecommerce/ecom-sub-nav';

/**
 * Client-side providers + chrome for the ecommerce demo. Lifted out of
 * `src/app/demo/ecommerce/layout.tsx` (Phase 10d D4) so the layout can
 * be a Server Component and export per-route `metadata`. Next.js
 * forbids metadata exports on `'use client'` modules.
 *
 * Stacking order inside the demo surface (top → bottom):
 *   1. EcomDemoBanner — terminal-styled "this is a demo" top strip
 *   2. EcomSubNav — Tuna Shop wordmark + `shop · cart` wayfinding
 *   3. Page content (`children`)
 *   4. EcomFooter — mission paragraph + back-to-site links
 *
 * All four are distinct from the session-scoped site chrome
 * (SessionPulse + LiveStrip + HomeBar) which renders above them.
 */
export function EcomProviders({ children }: { children: React.ReactNode }) {
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
