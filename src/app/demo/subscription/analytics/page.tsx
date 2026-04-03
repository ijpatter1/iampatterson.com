import type { Metadata } from 'next';

import { SubscriptionDashboard } from '@/components/demo/subscription/analytics-dashboard';

export const metadata: Metadata = {
  title: 'Tuna Subscription Analytics — Dashboard',
  description:
    'Subscription analytics dashboard built on BigQuery mart tables via Dataform. MRR trends, cohort retention, churn analysis, and LTV by acquisition source.',
};

export default function SubscriptionAnalyticsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <SubscriptionDashboard />
    </main>
  );
}
