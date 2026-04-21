import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CheckoutForm } from '@/components/demo/ecommerce/checkout-form';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';

export const metadata: Metadata = {
  title: 'Checkout | The Tuna Shop',
};

export default function CheckoutPage() {
  // Suspense boundary is required because CheckoutForm calls
  // `useSearchParams()` to read utm_campaign for the live warehouse-write
  // readout; without the boundary Next.js bails the whole page out of
  // static generation.
  return (
    <ToastProvider>
      <main className="mx-auto max-w-content px-6 py-12">
        <Suspense fallback={null}>
          <CheckoutForm />
        </Suspense>
      </main>
    </ToastProvider>
  );
}
