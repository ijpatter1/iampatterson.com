'use client';

import { useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { useCart, type CartItem } from './cart-context';
import { useToast } from '@/components/demo/reveal/toast-provider';
import { LiveSidebar } from '@/components/demo/reveal/live-sidebar';
import { WalkthroughBlurb } from '@/components/demo/reveal/walkthrough-blurb';
import { useSessionContext } from '@/hooks/useSessionContext';
import { DataQualityReadout } from './data-quality-readout';
import { products as allProducts } from '@/lib/demo/products';
import { trackRemoveFromCart } from '@/lib/events/track';

/**
 * Phase 9F D7, cart page content.
 *
 * Fires a `view_cart` toast on mount; renders the prototype's editorial
 * cart-row layout with a summary column and a Pattern 2 `LiveSidebar`
 * carrying the 6-assertion data-quality checklist.
 *
 * UAT r2 follow-up (2026-04-21):
 * - Remove + decrement-to-zero now fire `remove_from_cart` via
 *   `trackRemoveFromCart` and a `near-cart` toast so the event the
 *   walkthrough advertises actually lands.
 * - Line-item layout switched to a mobile-vertical / desktop-grid
 *   stack. The pre-fix `grid-cols-[1fr_90px_90px_90px]` (4×fixed)
 *   overflowed on 360px (90×3 + 36px gaps = 306px, leaving 6px for
 *   the item column inside px-6 content padding). Mobile now stacks
 *   image+name on one row and controls+prices on the next; sm+
 *   returns to the original 4-column grid.
 */
export function CartView() {
  const { items, itemCount, total, updateQuantity, removeItem } = useCart();
  const { push } = useToast();
  const session = useSessionContext();
  const firedRef = useRef(false);
  const lookup = useMemo(() => Object.fromEntries(allProducts.map((p) => [p.id, p])), []);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const t = setTimeout(() => {
      push({
        event_name: 'view_cart',
        detail: `items=${itemCount}  value=${total.toFixed(2)}`,
        routing: ['GA4', 'BigQuery'],
        position: 'near-cart',
        duration: 2100,
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fire trackRemoveFromCart + a near-cart toast, then drop the item
   *  from cart state. Covers both the explicit "remove" link and the
   *  decrement-quantity-past-0 path (the latter routed here from the
   *  minus button when quantity === 1). `quantity` on the event is
   *  how many units left the cart, matching GA4's remove_from_cart
   *  shape. */
  const fireRemoveFromCart = (item: CartItem) => {
    trackRemoveFromCart({
      product_id: item.product_id,
      product_name: item.product_name,
      product_price: item.product_price,
      quantity: item.quantity,
    });
    push({
      event_name: 'remove_from_cart',
      detail: `item_id=${item.product_id}  quantity=${item.quantity}`,
      routing: ['GA4', 'BigQuery'],
      position: 'near-cart',
      duration: 2000,
    });
    removeItem(item.product_id);
  };

  const handleDecrement = (item: CartItem) => {
    if (item.quantity <= 1) {
      fireRemoveFromCart(item);
      return;
    }
    updateQuantity(item.product_id, item.quantity - 1);
  };

  const isEmpty = items.length === 0;

  return (
    <div className="flex flex-col gap-10">
      <Link
        href="/demo/ecommerce"
        className="font-mono text-xs text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
      >
        ← continue shopping
      </Link>
      <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] tracking-[-0.015em] text-[var(--shop-warm-brown,#5C4A3D)]">
        your cart
      </h1>

      <WalkthroughBlurb route="cart">
        Your cart. Every add or remove already fired an{' '}
        <span className="font-mono">add_to_cart</span> or{' '}
        <span className="font-mono">remove_from_cart</span> event. Tap{' '}
        <em className="not-italic">see the stack ↓</em> to jump to the data-quality sidebar: it runs
        six Dataform assertions (schema, volume, session-join, freshness, null-checks, referential
        integrity) against the events as they flow through.
      </WalkthroughBlurb>

      {/* Sidebar slot is sized to fit the LiveSidebar's intrinsic
          `lg:w-[360px]`. A 320px slot let the 360px sidebar overflow
          its cell by 40px, which extended the document scrollWidth on
          iPad-Mini-landscape (1024×768) and produced a 16px horizontal
          scroll. `minmax(0,1fr)` on the article column prevents
          unbreakable min-content from re-inflating the column past
          its fr-share. Phase 10d D1 mobile-matrix regression pin. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <article className="flex flex-col gap-4">
          {isEmpty ? (
            <div className="flex flex-col items-start gap-3 rounded border border-[var(--shop-warm-brown,#5C4A3D)]/12 bg-[var(--shop-cream-2,#F5EEDB)] p-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
                [ cart · empty ]
              </div>
              <p className="text-[15px] text-[var(--shop-warm-brown,#5C4A3D)]/80">
                Nothing in here yet. The demo is more fun with a plush in it. Add one, and the
                add_to_cart event lands in BigQuery before you get here.
              </p>
              <Link
                href="/demo/ecommerce"
                className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--shop-terracotta,#C4703A)] hover:underline"
              >
                back to the shop →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--shop-warm-brown,#5C4A3D)]/12">
              {/* Header row, desktop only. On mobile each line item is
                  a two-row stack so there are no columns to label. */}
              <div className="hidden grid-cols-[minmax(0,1fr)_90px_80px_80px] gap-3 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/60 sm:grid">
                <span>item</span>
                <span className="text-right">qty</span>
                <span className="text-right">price</span>
                <span className="text-right">line</span>
              </div>
              {items.map((item) => {
                const p = lookup[item.product_id];
                return (
                  <div
                    key={item.product_id}
                    data-cart-line=""
                    className="flex flex-col gap-3 py-4 text-[var(--shop-warm-brown,#5C4A3D)] sm:grid sm:grid-cols-[minmax(0,1fr)_90px_80px_80px] sm:items-center sm:gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {p ? (
                        <div
                          className="relative h-12 w-12 shrink-0 overflow-hidden rounded"
                          style={{ background: p.palette[0] }}
                        >
                          <Image
                            src={p.image.src}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex min-w-0 flex-col">
                        <div className="truncate font-display text-base leading-tight">
                          {item.product_name}
                        </div>
                        <button
                          type="button"
                          onClick={() => fireRemoveFromCart(item)}
                          className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--shop-terracotta,#C4703A)] hover:underline"
                          aria-label={`Remove ${item.product_name}`}
                        >
                          remove
                        </button>
                      </div>
                    </div>
                    {/* Controls row. Mobile: qty on the left, price +
                        line on the right. sm+: each in its own grid cell. */}
                    <div className="flex items-center gap-1.5 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => handleDecrement(item)}
                        aria-label={`Decrease quantity for ${item.product_name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--shop-warm-brown,#5C4A3D)]/30 text-xs hover:border-[var(--shop-terracotta,#C4703A)] sm:h-6 sm:w-6"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        aria-label={`Increase quantity for ${item.product_name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--shop-warm-brown,#5C4A3D)]/30 text-xs hover:border-[var(--shop-terracotta,#C4703A)] sm:h-6 sm:w-6"
                      >
                        +
                      </button>
                      {/* Mobile-only inline prices. Desktop hides these
                          since the 4-col grid has dedicated cells. */}
                      <div className="ml-auto flex items-baseline gap-3 text-sm sm:hidden">
                        <span className="text-[var(--shop-warm-brown,#5C4A3D)]/70">
                          ${item.product_price.toFixed(2)}
                        </span>
                        <span className="font-medium">
                          ${(item.product_price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {/* Desktop-only price + line cells. */}
                    <div className="hidden text-right text-sm sm:block">
                      ${item.product_price.toFixed(2)}
                    </div>
                    <div className="hidden text-right text-sm font-medium sm:block">
                      ${(item.product_price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isEmpty ? (
            <section className="flex flex-col gap-3 rounded border border-[var(--shop-warm-brown,#5C4A3D)]/12 bg-[var(--shop-cream-2,#F5EEDB)] p-5">
              <div className="flex items-center justify-between text-sm text-[var(--shop-warm-brown,#5C4A3D)]">
                <span>subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-[var(--shop-warm-brown,#5C4A3D)]/70">
                <span>shipping</span>
                <span>calculated at checkout</span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--shop-warm-brown,#5C4A3D)]/15 pt-3 text-lg font-medium text-[var(--shop-warm-brown,#5C4A3D)]">
                <span>total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <Link
                href="/demo/ecommerce/checkout"
                className="mt-2 inline-block rounded bg-[var(--shop-terracotta,#C4703A)] px-5 py-3 text-center text-sm font-medium text-[var(--shop-cream,#FBF6EA)] transition-opacity hover:opacity-90"
              >
                proceed to checkout →
              </Link>
              <p className="text-[11px] text-[var(--shop-warm-brown,#5C4A3D)]/60">
                a portion goes to no-kill rescues · 30-day returns · instrumented end-to-end
              </p>
            </section>
          ) : null}
        </article>

        <LiveSidebar
          route="cart"
          title="Data quality · 6 assertions running"
          tag="UNDER · DATAFORM ASSERTIONS"
        >
          <DataQualityReadout
            itemCount={itemCount}
            live={{
              // Only pass stream-level stats when at least one event has
              // flowed, so the assertion falls back to the cart-itemCount
              // threshold for a fresh session with no events yet.
              addToCartInLast30s:
                session.events_in_session > 0 ? session.add_to_cart_in_last_30s : undefined,
              sessionId: session.session_id,
              secondsSinceLastEvent: session.last_event_at
                ? session.seconds_since_last_event
                : undefined,
              lastEventName: session.last_event_name,
            }}
          />
        </LiveSidebar>
      </div>
    </div>
  );
}
