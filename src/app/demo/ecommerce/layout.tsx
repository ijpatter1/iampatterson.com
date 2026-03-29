'use client';

import { CartProvider } from '@/components/demo/ecommerce/cart-context';

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
