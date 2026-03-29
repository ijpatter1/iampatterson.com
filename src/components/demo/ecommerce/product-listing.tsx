import Link from 'next/link';

import { products } from '@/lib/demo/products';

export function ProductListing() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/demo/ecommerce/${product.id}`}
          className="group rounded-lg border border-neutral-200 p-5 transition-all hover:border-neutral-400 hover:shadow-md"
        >
          <div className="mb-4 flex h-40 items-center justify-center rounded bg-neutral-100 text-4xl">
            🐾
          </div>
          <h3 className="text-base font-semibold text-neutral-900 group-hover:text-neutral-700">
            {product.name}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">{product.description}</p>
          <p className="mt-3 text-lg font-semibold text-neutral-900">${product.price.toFixed(2)}</p>
        </Link>
      ))}
    </div>
  );
}
