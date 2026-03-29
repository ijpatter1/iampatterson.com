import type { Metadata } from 'next';

import { ProductListing } from '@/components/demo/ecommerce/product-listing';

export const metadata: Metadata = {
  title: 'The Tuna Shop',
  description:
    'A fully instrumented e-commerce storefront. Browse products, add to cart, and checkout — every interaction fires events through the full measurement stack.',
};

export default function EcommerceDemoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          The Tuna Shop
        </h1>
        <p className="mt-2 text-base text-neutral-600">
          A fully instrumented e-commerce storefront. Browse, add to cart, and checkout — every
          interaction generates events that flow through the full measurement stack.
        </p>
      </div>
      <ProductListing />
    </main>
  );
}
