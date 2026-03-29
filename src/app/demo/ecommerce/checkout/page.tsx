import type { Metadata } from 'next';

import { CheckoutForm } from '@/components/demo/ecommerce/checkout-form';

export const metadata: Metadata = {
  title: 'Checkout — The Tuna Shop',
};

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold text-neutral-900">Checkout</h1>
      <CheckoutForm />
    </main>
  );
}
