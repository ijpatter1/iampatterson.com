'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { OrderConfirmation } from '@/components/demo/ecommerce/order-confirmation';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id') ?? 'ORD-UNKNOWN';
  const total = parseFloat(searchParams.get('total') ?? '0');
  const items = parseInt(searchParams.get('items') ?? '0', 10);

  return <OrderConfirmation orderId={orderId} orderTotal={total} itemCount={items} />;
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-neutral-500">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
