import type { Metadata } from 'next';

import { DashboardPreview } from '@/components/demo/dashboard/dashboard-preview';
import { PlanCards } from '@/components/demo/subscription/plan-cards';
import { subscriptionDashboardData } from '@/lib/demo/dashboard-data';

export const metadata: Metadata = {
  title: 'Tuna Subscription',
  description:
    'A subscription product demo from signup to retention. Select a plan, start a trial, and see the full event lifecycle.',
};

export default function SubscriptionDemoPage() {
  return (
    <main className="mx-auto max-w-content px-6 py-12">
      <div className="mb-10 max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight text-content sm:text-3xl">
          The Tuna Box
        </h1>
        <p className="mt-2 text-lg text-content-secondary">Monthly Tuna-branded joy, delivered.</p>
        <p className="mt-4 text-base text-content-secondary">
          Every month, a curated box of Tuna Melts My Heart exclusives — apparel, accessories, art
          prints, and surprises you can&apos;t get anywhere else. Cancel anytime.
        </p>
        <p className="mt-2 text-sm font-medium text-content">
          First box 50% off with any plan. No commitment — cancel before your second box ships and
          pay nothing more.
        </p>
      </div>
      <PlanCards />
      <DashboardPreview
        kpis={subscriptionDashboardData.kpis.slice(0, 3)}
        narrative="Plan selections and trial signups generate the same events that power these subscription metrics. MRR, cohort retention, and trial-to-paid conversion are all computed from the event pipeline running beneath this demo."
        analyticsHref="/demo/subscription/analytics"
      />
    </main>
  );
}
