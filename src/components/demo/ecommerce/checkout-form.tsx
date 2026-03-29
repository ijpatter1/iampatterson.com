'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { trackBeginCheckout, trackPurchase } from '@/lib/events/track';
import { useCart } from './cart-context';

export function CheckoutForm() {
  const { items, total, itemCount, clearCart } = useCart();
  const router = useRouter();
  const checkoutFired = useRef(false);

  useEffect(() => {
    if (!checkoutFired.current && items.length > 0) {
      trackBeginCheckout({ cart_total: total, item_count: itemCount });
      checkoutFired.current = true;
    }
  }, [items.length, total, itemCount]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const productsJson = JSON.stringify(
      items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        price: i.product_price,
        quantity: i.quantity,
      })),
    );

    trackPurchase({
      order_id: orderId,
      order_total: total,
      item_count: itemCount,
      products: productsJson,
    });

    clearCart();
    router.push(
      `/demo/ecommerce/confirmation?order_id=${orderId}&total=${total.toFixed(2)}&items=${itemCount}`,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Shipping Information</h2>
        <p className="text-sm text-neutral-500">
          This is a demo — no real data is collected or stored.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-neutral-700">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              defaultValue="Demo"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-neutral-700">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              defaultValue="User"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            defaultValue="demo@example.com"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-neutral-700">
            Address
          </label>
          <input
            id="address"
            type="text"
            defaultValue="123 Demo Street"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-neutral-700">
              City
            </label>
            <input
              id="city"
              type="text"
              defaultValue="Atlanta"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-neutral-700">
              State
            </label>
            <input
              id="state"
              type="text"
              defaultValue="GA"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="zip" className="block text-sm font-medium text-neutral-700">
              ZIP
            </label>
            <input
              id="zip"
              type="text"
              defaultValue="30309"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-neutral-200 pt-6">
        <div className="mb-4 flex justify-between text-sm">
          <span className="text-neutral-600">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </span>
          <span className="font-semibold text-neutral-900">${total.toFixed(2)}</span>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
        >
          Complete Purchase
        </button>
        <p className="mt-3 text-center text-xs text-neutral-400">
          No payment is processed. This is a simulated purchase for demonstration purposes.
        </p>
      </div>
    </form>
  );
}
