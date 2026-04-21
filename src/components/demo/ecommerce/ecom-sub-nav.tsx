'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCart } from './cart-context';

/**
 * Phase 9F sub-nav (adopted from the prototype per user direction 2026-04-21).
 *
 * Sits at the top of every `/demo/ecommerce/*` page directly below the
 * site chrome (`SessionPulse` + `LiveStrip` + `HomeBar`). Two links:
 * `shop` → `/demo/ecommerce`, `cart` → `/demo/ecommerce/cart` with a
 * live item-count badge. The current route is highlighted via the
 * terracotta accent. Distinct from the site's session-scoped nav —
 * this is the demo's own shop-scoped wayfinding.
 */
export function EcomSubNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const isShopHome = pathname === '/demo/ecommerce';
  const isCart = pathname === '/demo/ecommerce/cart';

  return (
    <nav
      aria-label="Tuna Shop sections"
      className="flex items-center gap-4 border-b border-[var(--shop-warm-brown,#5C4A3D)]/12 px-6 py-3 font-mono text-xs uppercase tracking-[0.12em]"
    >
      <Link
        href="/demo/ecommerce"
        aria-current={isShopHome ? 'page' : undefined}
        className={
          isShopHome
            ? 'text-[var(--shop-terracotta,#C4703A)]'
            : 'text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]'
        }
      >
        shop
      </Link>
      <span aria-hidden="true" className="text-[var(--shop-warm-brown,#5C4A3D)]/30">
        ·
      </span>
      <Link
        href="/demo/ecommerce/cart"
        aria-current={isCart ? 'page' : undefined}
        className={`inline-flex items-center gap-1.5 ${
          isCart
            ? 'text-[var(--shop-terracotta,#C4703A)]'
            : 'text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]'
        }`}
      >
        <span>cart</span>
        <span
          className={
            itemCount > 0
              ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--shop-terracotta,#C4703A)] px-1.5 text-[10px] text-[var(--shop-cream,#FBF6EA)]'
              : 'inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--shop-warm-brown,#5C4A3D)]/30 px-1.5 text-[10px] text-[var(--shop-warm-brown,#5C4A3D)]/70'
          }
        >
          {itemCount}
        </span>
      </Link>
    </nav>
  );
}
