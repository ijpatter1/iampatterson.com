import Link from 'next/link';

interface OrderConfirmationProps {
  orderId: string;
  orderTotal: number;
  itemCount: number;
}

export function OrderConfirmation({ orderId, orderTotal, itemCount }: OrderConfirmationProps) {
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <div className="mb-6 text-4xl">🎉</div>
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Order Confirmed</h1>
      <p className="mb-6 text-sm text-neutral-500">Order {orderId}</p>

      <div className="mb-8 rounded-lg border border-neutral-200 p-6">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">Items</span>
          <span className="font-medium text-neutral-900">{itemCount}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-neutral-600">Total</span>
          <span className="font-semibold text-neutral-900">${orderTotal.toFixed(2)}</span>
        </div>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-neutral-600">
        Thanks for your (simulated) order. This purchase event just fired through sGTM, landed in
        BigQuery, and updated the dashboards. Flip the card to see exactly what happened.
      </p>

      <Link
        href="/demo/ecommerce"
        className="text-sm font-medium text-neutral-900 underline hover:text-neutral-700"
      >
        Back to The Tuna Shop
      </Link>
    </div>
  );
}
