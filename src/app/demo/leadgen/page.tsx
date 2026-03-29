import type { Metadata } from 'next';

import { LeadgenLanding } from '@/components/demo/leadgen/leadgen-landing';
import { PartnershipForm } from '@/components/demo/leadgen/partnership-form';

export const metadata: Metadata = {
  title: 'Tuna Partnerships',
  description:
    'A lead generation landing page with full funnel tracking. Submit a partnership inquiry and see every form interaction flow through the measurement stack.',
};

export default function LeadgenDemoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <LeadgenLanding />
        <div>
          <h3 className="mb-6 text-lg font-semibold text-neutral-900">Get in Touch</h3>
          <PartnershipForm />
        </div>
      </div>
    </main>
  );
}
