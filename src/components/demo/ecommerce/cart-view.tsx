'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';

import { useCart } from './cart-context';
import { useToast } from '@/components/demo/reveal/toast-provider';
import { LiveSidebar } from '@/components/demo/reveal/live-sidebar';
import { useSessionContext } from '@/hooks/useSessionContext';
import { DataQualityReadout } from './data-quality-readout';
import { products as allProducts } from '@/lib/demo/products';

/**
 * Phase 9F D7 — cart page content.
 *
 * Fires a `view_cart` toast on mount; renders the prototype's editorial
 * cart-row layout with a summary column and a Pattern 2 `LiveSidebar`
 * carrying the 6-assertion data-quality checklist.
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

      <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-10">
        <article className="flex flex-col gap-4">
          {isEmpty ? (
            <div className="flex flex-col items-start gap-3 rounded border border-[var(--shop-warm-brown,#5C4A3D)]/12 bg-[var(--shop-cream-2,#F5EEDB)] p-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
                [ cart · empty ]
              </div>
              <p className="text-[15px] text-[var(--shop-warm-brown,#5C4A3D)]/80">
                nothing in here yet. the more interesting part of this demo is watching the events
                flow through the stack, so head back and grab a plush.
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
              <div className="grid grid-cols-[1fr_90px_90px_90px] gap-3 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/60">
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
                    className="grid grid-cols-[1fr_90px_90px_90px] items-center gap-3 py-4 text-[var(--shop-warm-brown,#5C4A3D)]"
                  >
                    <div className="flex items-center gap-3">
                      {p ? (
                        <div
                          className="h-12 w-12 shrink-0 rounded"
                          style={{ background: p.palette[0] }}
                          aria-hidden="true"
                        >
                          <div
                            className="mx-auto mt-2 h-8 w-8 rounded"
                            style={{ background: p.palette[1] }}
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-col">
                        <div className="font-display text-base leading-tight">
                          {item.product_name}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.product_id)}
                          className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--shop-terracotta,#C4703A)] hover:underline"
                          aria-label={`Remove ${item.product_name}`}
                        >
                          remove
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        aria-label={`Decrease quantity for ${item.product_name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--shop-warm-brown,#5C4A3D)]/30 text-xs hover:border-[var(--shop-terracotta,#C4703A)]"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        aria-label={`Increase quantity for ${item.product_name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--shop-warm-brown,#5C4A3D)]/30 text-xs hover:border-[var(--shop-terracotta,#C4703A)]"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right text-sm">${item.product_price.toFixed(2)}</div>
                    <div className="text-right text-sm font-medium">
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
          tag="UNDER · TIER 2 · DATAFORM"
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
