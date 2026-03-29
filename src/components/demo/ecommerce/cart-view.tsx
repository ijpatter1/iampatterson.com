'use client';

import Link from 'next/link';

import { useCart } from './cart-context';

export function CartView() {
  const { items, total, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-lg text-neutral-600">Your cart is empty.</p>
        <Link
          href="/demo/ecommerce"
          className="text-sm font-medium text-neutral-900 underline hover:text-neutral-700"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-neutral-200">
        {items.map((item) => (
          <div key={item.product_id} className="flex items-center justify-between py-4">
            <div>
              <h3 className="font-medium text-neutral-900">{item.product_name}</h3>
              <p className="text-sm text-neutral-500">${item.product_price.toFixed(2)} each</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={item.quantity}
                onChange={(e) => updateQuantity(item.product_id, Number(e.target.value))}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                aria-label={`Quantity for ${item.product_name}`}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="w-20 text-right font-medium text-neutral-900">
                ${(item.product_price * item.quantity).toFixed(2)}
              </p>
              <button
                type="button"
                onClick={() => removeItem(item.product_id)}
                className="text-sm text-neutral-500 hover:text-neutral-900"
                aria-label={`Remove ${item.product_name}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-neutral-200 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-neutral-900">Order Total</p>
          <p className="text-lg font-semibold text-neutral-900">${total.toFixed(2)}</p>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <Link
            href="/demo/ecommerce/checkout"
            className="rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
          >
            Proceed to Checkout
          </Link>
          <Link
            href="/demo/ecommerce"
            className="text-sm text-neutral-600 underline hover:text-neutral-900"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
