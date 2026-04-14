'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { getPlan } from '@/lib/demo/plans';
import { trackTrialSignup } from '@/lib/events/track';

interface TrialSignupFormProps {
  planId: string;
}

export function TrialSignupForm({ planId }: TrialSignupFormProps) {
  const plan = getPlan(planId);
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  if (!plan) {
    return <p className="text-neutral-500">Plan not found. Please select a plan.</p>;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!plan || submitted) return;

    trackTrialSignup({
      plan_id: plan.id,
      plan_name: plan.name,
      plan_price: plan.price,
    });

    setSubmitted(true);
    router.push(`/demo/subscription/dashboard?plan=${plan.id}`);
  }

  const discountedPrice = (plan.price / 2).toFixed(2);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 rounded-lg border border-neutral-200 p-4">
        <h2 className="font-semibold text-neutral-900">{plan.name}</h2>
        <p className="text-sm text-neutral-600">{plan.itemCount} per box</p>
        <p className="mt-2 text-sm text-neutral-600">
          First box <span className="font-semibold text-neutral-900">50% off</span>: $
          {discountedPrice}{' '}
          <span className="text-neutral-400 line-through">${plan.price.toFixed(2)}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
            Name
          </label>
          <input
            id="name"
            type="text"
            defaultValue="Demo User"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
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
            Shipping Address
          </label>
          <input
            id="address"
            type="text"
            defaultValue="123 Demo Street, Atlanta, GA 30309"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
        >
          Start My Trial
        </button>
        <p className="text-center text-xs text-neutral-400">
          No payment is processed. This is a simulated signup for demonstration purposes.
        </p>
      </form>
    </div>
  );
}
