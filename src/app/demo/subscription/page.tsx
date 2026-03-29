import type { Metadata } from 'next';

import { PlanCards } from '@/components/demo/subscription/plan-cards';

export const metadata: Metadata = {
  title: 'Tuna Subscription',
  description:
    'A subscription product demo from signup to retention. Select a plan, start a trial, and see the full event lifecycle.',
};

export default function SubscriptionDemoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          The Tuna Box
        </h1>
        <p className="mt-2 text-lg text-neutral-600">Monthly Tuna-branded joy, delivered.</p>
        <p className="mt-4 text-base text-neutral-600">
          Every month, a curated box of Tuna Melts My Heart exclusives — apparel, accessories, art
          prints, and surprises you can&apos;t get anywhere else. Cancel anytime.
        </p>
        <p className="mt-2 text-sm font-medium text-neutral-900">
          First box 50% off with any plan. No commitment — cancel before your second box ships and
          pay nothing more.
        </p>
      </div>
      <PlanCards />
    </main>
  );
}
