import type { Metadata } from 'next';

import { LeadgenThankYou } from '@/components/demo/leadgen/leadgen-thank-you';

export const metadata: Metadata = {
  title: 'Inquiry Submitted — Tuna Partnerships',
};

export default function ThanksPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <LeadgenThankYou />
    </main>
  );
}
