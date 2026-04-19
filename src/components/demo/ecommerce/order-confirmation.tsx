import Link from 'next/link';

interface OrderConfirmationProps {
  orderId: string;
  orderTotal: number;
  itemCount: number;
}

export function OrderConfirmation({ orderId, orderTotal, itemCount }: OrderConfirmationProps) {
  return (
    <div className="mx-auto max-w-lg px-5 py-12 md:px-10">
      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
        Order confirmed · {orderId}
      </div>
      <h1
        className="mt-2 font-display font-normal text-neutral-900"
        style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', lineHeight: '1.05' }}
      >
        Thanks for the (simulated) order.
      </h1>

      <div className="mt-8 border-y border-neutral-200 py-5">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">Items</span>
          <span className="font-medium text-neutral-900">{itemCount}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-neutral-600">Total</span>
          <span className="font-semibold text-neutral-900">${orderTotal.toFixed(2)}</span>
        </div>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-neutral-600">
        The checkout funnel fires purchase events through sGTM, lands them in BigQuery, and feeds
        the Dataform mart layer the dashboards below query. Look under the hood to watch event
        traffic flow through the pipeline — or scroll down to see where it lands.
      </p>

      <Link
        href="/demo/ecommerce"
        className="mt-6 inline-block text-sm text-neutral-900 underline underline-offset-4 hover:text-neutral-700"
      >
        Back to The Tuna Shop
      </Link>
    </div>
  );
}
