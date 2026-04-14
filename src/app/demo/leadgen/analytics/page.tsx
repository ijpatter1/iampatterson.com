import type { Metadata } from 'next';

import { LeadGenDashboard } from '@/components/demo/leadgen/analytics-dashboard';

export const metadata: Metadata = {
  title: 'Tuna Partnerships Analytics | Dashboard',
  description:
    'Lead generation analytics dashboard built on BigQuery mart tables via Dataform. Lead funnel, cost per lead, quality distribution, and conversion trends.',
};

export default function LeadGenAnalyticsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <LeadGenDashboard />
    </main>
  );
}
