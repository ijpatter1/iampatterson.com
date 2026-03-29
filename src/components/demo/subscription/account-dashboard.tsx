'use client';

import Link from 'next/link';

import { getPlan } from '@/lib/demo/plans';

interface AccountDashboardProps {
  planId: string;
}

export function AccountDashboard({ planId }: AccountDashboardProps) {
  const plan = getPlan(planId);
  const planName = plan?.name ?? 'Unknown Plan';
  const planPrice = plan?.price ?? 0;

  const today = new Date();
  const nextShip = new Date(today);
  nextShip.setDate(nextShip.getDate() + 7);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 rounded-lg border border-neutral-200 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Subscription Status</h2>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
            Active (Trial)
          </span>
        </div>
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-600">Current Plan</dt>
            <dd className="font-medium text-neutral-900">{planName}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-600">Monthly Price</dt>
            <dd className="font-medium text-neutral-900">${planPrice.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-600">Next Box Ships</dt>
            <dd className="font-medium text-neutral-900">{nextShip.toLocaleDateString()}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-600">Trial Started</dt>
            <dd className="font-medium text-neutral-900">{today.toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
        >
          Upgrade
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
        >
          Downgrade
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Cancel
        </button>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-neutral-600">
        Your trial is active. In a real subscription, you&apos;d receive your first box within 5-7
        days. In this demo, we&apos;ve just fired a trial_signup event through the full stack. Flip
        the card to see your signup flow through consent, sGTM, BigQuery, and into the cohort
        models.
      </p>

      <Link
        href="/demo/subscription"
        className="mt-4 inline-block text-sm text-neutral-600 underline hover:text-neutral-900"
      >
        Back to plans
      </Link>
    </div>
  );
}
