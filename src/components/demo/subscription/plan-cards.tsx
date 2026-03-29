'use client';

import Link from 'next/link';

import { plans } from '@/lib/demo/plans';
import { trackPlanSelect } from '@/lib/events/track';

export function PlanCards() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`relative rounded-lg border p-6 ${
            plan.popular ? 'border-neutral-900 shadow-md' : 'border-neutral-200'
          }`}
        >
          {plan.popular && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
              Most Popular
            </span>
          )}
          <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
          <p className="mt-1 text-sm text-neutral-500">{plan.itemCount} per box</p>
          <p className="mt-4 text-3xl font-bold text-neutral-900">
            ${plan.price.toFixed(2)}
            <span className="text-sm font-normal text-neutral-500">/month</span>
          </p>
          <p className="mt-1 text-sm text-neutral-600">{plan.description}</p>
          <ul className="mt-4 space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-neutral-600">
                <span className="mt-0.5 text-neutral-400">-</span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href={`/demo/subscription/signup?plan=${plan.id}`}
            onClick={() =>
              trackPlanSelect({
                plan_id: plan.id,
                plan_name: plan.name,
                plan_price: plan.price,
              })
            }
            className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
              plan.popular
                ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                : 'border border-neutral-300 text-neutral-900 hover:bg-neutral-50'
            }`}
          >
            Start Free Trial
          </Link>
        </div>
      ))}
    </div>
  );
}
