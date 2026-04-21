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
    <article className="group relative flex flex-col gap-3 rounded-md border border-[#5C4A3D]/12 bg-[var(--shop-cream-2,#F5EEDB)] p-3 transition-shadow hover:shadow-md">
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
 * Pure 3-column product grid (Phase 9F D5). Effects (toast cascade,
 * useSearchParams, cart context wiring) live in `ListingView`; this
 * component is presentational so it composes cleanly into tests.
 */
export function ProductListing({ products, onAddToCart }: ProductListingProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
