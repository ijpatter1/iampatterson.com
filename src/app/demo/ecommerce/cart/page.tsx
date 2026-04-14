import type { Metadata } from 'next';

import { CartView } from '@/components/demo/ecommerce/cart-view';

export const metadata: Metadata = {
  title: 'Cart | The Tuna Shop',
};

export default function CartPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold text-neutral-900">Your Cart</h1>
      <CartView />
    </main>
  );
}
