'use client';

import Link from 'next/link';

import type { Product } from '@/lib/demo/products';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [c1, c2, c3] = product.palette;
  return (
    <article
      data-product-card=""
      className="group relative flex w-[78vw] max-w-[320px] shrink-0 snap-start flex-col gap-3 rounded-md border border-[#5C4A3D]/12 bg-[var(--shop-cream-2,#F5EEDB)] p-3 transition-shadow hover:shadow-md sm:w-auto sm:max-w-none sm:shrink sm:snap-none"
    >
      <Link href={`/demo/ecommerce/${product.id}`} className="flex flex-col gap-3">
        <div
          className="relative aspect-[4/5] w-full overflow-hidden rounded"
          style={{ background: c1 }}
        >
          <div
            className="absolute inset-x-6 top-1/2 h-1/2 -translate-y-1/2"
            style={{ background: c2 }}
          />
          <div className="absolute right-4 top-4 h-6 w-6 rounded-full" style={{ background: c3 }} />
          <div className="absolute bottom-2 left-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white/70">
            {product.imageLabel}
          </div>
          {product.tag ? (
            <div className="absolute right-2 top-2 rounded-full bg-[var(--shop-cream,#FBF6EA)] px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--shop-warm-brown,#5C4A3D)]">
              {product.tag}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 px-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--shop-warm-brown,#5C4A3D)]/70">
            {product.category}
          </div>
          <h3 className="font-display text-lg leading-tight text-[var(--shop-warm-brown,#5C4A3D)]">
            {product.name}
          </h3>
        </div>
      </Link>
      <div className="flex items-center justify-between px-1">
        <span className="text-base font-medium text-[var(--shop-warm-brown,#5C4A3D)]">
          ${product.price.toFixed(2)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          aria-label={`Add ${product.name} to cart`}
          className="rounded border border-[var(--shop-terracotta,#C4703A)] px-3 py-1 text-xs font-medium text-[var(--shop-terracotta,#C4703A)] transition-colors hover:bg-[var(--shop-terracotta,#C4703A)] hover:text-[var(--shop-cream,#FBF6EA)]"
        >
          add to cart
        </button>
      </div>
    </article>
  );
}

interface ProductListingProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

/**
 * Product listing, 3-column grid on desktop, horizontal scroll-snap
 * carousel on mobile (UAT r2 item 11).
 *
 * Pre-r2, mobile stacked the 6 cards as a single-column grid, making
 * the listing page a long scroll. Per the user: products should swipe
 * left-to-right on mobile instead.
 *
 * Implementation uses pure CSS scroll-snap, no JS library needed.
 * - Mobile (<sm): flex with `overflow-x-auto snap-x snap-mandatory`;
 *   each card is `w-[78vw] max-w-[320px] snap-start`. The `-mx-6 px-6`
 *   gutter trick lets the carousel bleed to the viewport edge while
 *   keeping the first/last card's padding intact.
 * - sm+ (≥640px): flips back to 2-column grid; all snap/width rules
 *   clear via `sm:w-auto sm:shrink sm:snap-none` on the card + the
 *   responsive overrides on the container.
 * - lg+ (≥1024px): 3-column grid.
 *
 * Effects (toast cascade, useSearchParams, cart context wiring) live
 * in `ListingView`; this component is presentational so it composes
 * cleanly into tests.
 */
export function ProductListing({ products, onAddToCart }: ProductListingProps) {
  return (
    <div
      data-product-listing=""
      className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
