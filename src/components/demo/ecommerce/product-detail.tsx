'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

import type { Product } from '@/lib/demo/products';
import { getRelatedProducts } from '@/lib/demo/products';
import { trackAddToCart, trackProductView } from '@/lib/events/track';
import { useCart } from './cart-context';
import { useToast } from '@/components/demo/reveal/toast-provider';
import { LiveSidebar } from '@/components/demo/reveal/live-sidebar';
import { WalkthroughBlurb } from '@/components/demo/reveal/walkthrough-blurb';
import { useSessionContext } from '@/hooks/useSessionContext';
import { StagingLayerReadout } from './staging-layer-readout';

interface ProductDetailProps {
  product: Product;
}

/**
 * Phase 9F D6 — product detail page content.
 *
 * Fires `trackProductView` + a `product_view` `near-product` toast on mount;
 * renders the 2-column editorial layout (palette-tile image + info panel
 * with blurb, add-to-cart, pr-details list) and a Pattern 2 `LiveSidebar`
 * showing the staging-layer transformation for the current event.
 * Add-to-cart wires `trackAddToCart` + `useCart.addItem` + an
 * `add_to_cart` `near-cart` toast.
 */
export function ProductDetail({ product }: ProductDetailProps) {
  const { addItem } = useCart();
  const { push } = useToast();
  const session = useSessionContext();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    trackProductView({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_category: product.category,
    });

    const t = setTimeout(() => {
      push({
        event_name: 'product_view',
        detail: `item_id=${product.id}  price=${product.price}`,
        routing: ['GA4', 'BigQuery'],
        position: 'near-product',
        duration: 2100,
      });
    }, 500);

    return () => clearTimeout(t);
  }, [product.id, product.name, product.price, product.category, push]);

  function handleAddToCart() {
    trackAddToCart({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      quantity: 1,
    });
    addItem({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      quantity: 1,
    });
    push({
      event_name: 'add_to_cart',
      detail: `item_id=${product.id}  value=${product.price}`,
      routing: ['GA4', 'BigQuery'],
      position: 'near-cart',
      duration: 2100,
    });
  }

  const related = getRelatedProducts(product.id, 3);
  const [c1, c2, c3] = product.palette;

  return (
    <div className="flex flex-col gap-10">
      <Link
        href="/demo/ecommerce"
        className="font-mono text-xs text-[var(--shop-warm-brown,#5C4A3D)]/70 hover:text-[var(--shop-terracotta,#C4703A)]"
      >
        ← back to the shop
      </Link>

      <WalkthroughBlurb route={`product-${product.id}`}>
        The product detail. A <span className="font-mono">product_view</span> event already fired
        through sGTM into BigQuery. On mobile, tap <em className="not-italic">see the stack ↓</em>{' '}
        to jump to the staging-layer sidebar — it shows the raw-to-typed cast Dataform runs on each
        row before it reaches the marts.
      </WalkthroughBlurb>

      <div className="grid gap-8 lg:grid-cols-[1fr_480px_auto] lg:gap-10">
        <article className="flex flex-col gap-6">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-lg"
            style={{ background: c1 }}
          >
            <div
              className="absolute inset-x-12 top-1/2 h-1/2 -translate-y-1/2 rounded"
              style={{ background: c2 }}
            />
            <div
              className="absolute right-8 top-8 h-14 w-14 rounded-full"
              style={{ background: c3 }}
            />
            <div className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.1em] text-white/70">
              {product.imageLabel}
            </div>
            {product.tag ? (
              <div className="absolute right-4 top-4 rounded-full bg-[var(--shop-cream,#FBF6EA)] px-3 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--shop-warm-brown,#5C4A3D)]">
                {product.tag}
              </div>
            ) : null}
          </div>
        </article>

        <div className="flex flex-col gap-4 lg:pt-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
            {product.category}
          </div>
          <h1 className="font-display text-4xl leading-[1.05] text-[var(--shop-warm-brown,#5C4A3D)] lg:text-[44px]">
            {product.name}
          </h1>
          <div className="text-xl font-medium text-[var(--shop-warm-brown,#5C4A3D)]">
            ${product.price.toFixed(2)}
          </div>
          <p className="text-[15px] leading-relaxed text-[var(--shop-warm-brown,#5C4A3D)]/80">
            {product.blurb}
          </p>

          <button
            type="button"
            onClick={handleAddToCart}
            aria-label={`Add ${product.name} to cart`}
            className="mt-2 flex items-center justify-between rounded border border-[var(--shop-terracotta,#C4703A)] bg-[var(--shop-terracotta,#C4703A)] px-5 py-3 text-sm font-medium text-[var(--shop-cream,#FBF6EA)] transition-opacity hover:opacity-90"
          >
            <span>add to cart</span>
            <span>${product.price.toFixed(2)}</span>
          </button>

          <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--shop-warm-brown,#5C4A3D)]/15 pt-4 text-xs text-[var(--shop-warm-brown,#5C4A3D)]/80">
            <li className="flex justify-between">
              <span>ships</span>
              <span>in 3–5 business days</span>
            </li>
            <li className="flex justify-between">
              <span>returns</span>
              <span>free, 30 days</span>
            </li>
            <li className="flex justify-between">
              <span>gives back</span>
              <span>a portion to no-kill rescues</span>
            </li>
            <li className="flex justify-between">
              <span>sku</span>
              <span className="font-mono">{product.id.toUpperCase()}</span>
            </li>
          </ul>
        </div>

        <LiveSidebar
          route={`product-${product.id}`}
          title="Staging layer · product_view"
          tag="UNDER · STAGING LAYER"
        >
          <StagingLayerReadout
            product={{ id: product.id, price: product.price }}
            live={{
              session_id: session.session_id,
              last_event_at: session.last_event_at,
              events_in_session: session.events_in_session,
            }}
          />
        </LiveSidebar>
      </div>

      {related.length > 0 ? (
        <section className="flex flex-col gap-4 border-t border-[var(--shop-warm-brown,#5C4A3D)]/12 pt-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
            other things in the shop
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((p) => (
              <Link
                key={p.id}
                href={`/demo/ecommerce/${p.id}`}
                className="flex flex-col gap-2 rounded border border-[var(--shop-warm-brown,#5C4A3D)]/12 p-3 transition-shadow hover:shadow-sm"
              >
                <div className="aspect-[4/5] w-full rounded" style={{ background: p.palette[0] }}>
                  <div
                    className="mx-auto mt-8 h-1/2 w-3/4 rounded"
                    style={{ background: p.palette[1] }}
                  />
                </div>
                <div className="font-display text-sm text-[var(--shop-warm-brown,#5C4A3D)]">
                  {p.name}
                </div>
                <div className="text-xs text-[var(--shop-warm-brown,#5C4A3D)]/70">
                  ${p.price.toFixed(2)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
