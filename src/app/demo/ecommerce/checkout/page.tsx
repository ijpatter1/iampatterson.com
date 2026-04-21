import type { Metadata } from 'next';

import { CheckoutForm } from '@/components/demo/ecommerce/checkout-form';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';

export const metadata: Metadata = {
  title: 'Checkout | The Tuna Shop',
};

export default function CheckoutPage() {
  return (
    <ToastProvider>
      <main className="mx-auto max-w-content px-6 py-12">
        <CheckoutForm />
      </main>
    </ToastProvider>
  );
}
