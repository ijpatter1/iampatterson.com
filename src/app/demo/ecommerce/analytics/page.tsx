import type { Metadata } from 'next';

import { EcommerceDashboard } from '@/components/demo/ecommerce/analytics-dashboard';

export const metadata: Metadata = {
  title: 'Tuna Shop Analytics | Dashboard',
  description:
    'E-commerce analytics dashboard built on BigQuery mart tables via Dataform. Revenue trends, channel attribution, product performance, and campaign ROAS.',
};

export default function EcommerceAnalyticsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <EcommerceDashboard />
    </main>
  );
}
