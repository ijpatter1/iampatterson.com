import type { Metadata } from 'next';

import { CartView } from '@/components/demo/ecommerce/cart-view';
import { ToastProvider } from '@/components/demo/reveal/toast-provider';

export const metadata: Metadata = {
  title: 'Cart | The Tuna Shop',
};

export default function CartPage() {
  return (
    <ToastProvider>
      <main className="mx-auto max-w-content px-6 py-12">
        <CartView />
      </main>
    </ToastProvider>
  );
}
