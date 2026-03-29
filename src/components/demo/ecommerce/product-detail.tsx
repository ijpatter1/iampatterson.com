'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import type { Product } from '@/lib/demo/products';
import { getRelatedProducts } from '@/lib/demo/products';
import { trackProductView, trackAddToCart } from '@/lib/events/track';
import { useCart } from './cart-context';

interface ProductDetailProps {
  product: Product;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const { addItem } = useCart();

  useEffect(() => {
    trackProductView({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_category: product.category,
    });
  }, [product]);

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
  }

  const related = getRelatedProducts(product.id, 2);

  return (
    <div>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex h-64 items-center justify-center rounded-lg bg-neutral-100 text-6xl md:h-96">
          🐾
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{product.name}</h1>
          <p className="mt-2 text-2xl font-semibold text-neutral-900">
            ${product.price.toFixed(2)}
          </p>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">{product.description}</p>
          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-6 rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
          >
            Add to Cart
          </button>
          <Link
            href="/demo/ecommerce/cart"
            className="ml-4 text-sm text-neutral-600 underline hover:text-neutral-900"
          >
            View Cart
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">You might also like</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/demo/ecommerce/${r.id}`}
                className="rounded-lg border border-neutral-200 p-4 transition-all hover:border-neutral-400"
              >
                <h3 className="font-medium text-neutral-900">{r.name}</h3>
                <p className="text-sm text-neutral-600">${r.price.toFixed(2)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
