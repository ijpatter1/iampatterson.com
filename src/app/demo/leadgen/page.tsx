import type { Metadata } from 'next';

import { DashboardPreview } from '@/components/demo/dashboard/dashboard-preview';
import { LeadgenLanding } from '@/components/demo/leadgen/leadgen-landing';
import { PartnershipForm } from '@/components/demo/leadgen/partnership-form';
import { leadGenDashboardData } from '@/lib/demo/dashboard-data';

export const metadata: Metadata = {
  title: 'Tuna Partnerships',
  description:
    'A lead generation landing page with full funnel tracking. Submit a partnership inquiry and see every form interaction flow through the measurement stack.',
};

export default function LeadgenDemoPage() {
  return (
    <main className="mx-auto max-w-content px-6 py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <LeadgenLanding />
        <div>
          <h3 className="mb-6 text-lg font-semibold text-content">Get in Touch</h3>
          <PartnershipForm />
        </div>
      </div>
      <DashboardPreview
        kpis={leadGenDashboardData.kpis.slice(0, 3)}
        narrative="Every form interaction, from first field focus to qualified submission, feeds the lead funnel metrics below. The qualification scoring and cost-per-lead calculations are all computed from the same event pipeline."
        analyticsHref="/demo/leadgen/analytics"
      />
    </main>
  );
}
