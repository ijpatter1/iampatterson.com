'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

import {
  trackFormStart,
  trackFormFieldFocus,
  trackFormComplete,
  trackLeadQualify,
} from '@/lib/events/track';

const partnershipTypes = [
  { value: 'sponsored_content', label: 'Sponsored Content' },
  { value: 'product_collaboration', label: 'Product Collaboration' },
  { value: 'event_sponsorship', label: 'Event Sponsorship' },
  { value: 'licensing', label: 'Licensing' },
  { value: 'not_sure', label: 'Not sure yet' },
];

const budgetRanges = [
  { value: 'under_5k', label: 'Under $5k' },
  { value: '5k_15k', label: '$5k - $15k' },
  { value: '15k_50k', label: '$15k - $50k' },
  { value: '50k_plus', label: '$50k+' },
  { value: 'prefer_to_discuss', label: 'Prefer to discuss' },
];

function qualifyLead(partnershipType: string, budgetRange: string): string {
  if (budgetRange === '50k_plus' || budgetRange === '15k_50k') return 'hot';
  if (budgetRange === '5k_15k' && partnershipType !== 'not_sure') return 'warm';
  return 'cold';
}

export function PartnershipForm() {
  const router = useRouter();
  const formStarted = useRef(false);

  function handleFocus(fieldName: string) {
    if (!formStarted.current) {
      trackFormStart('partnership_inquiry');
      formStarted.current = true;
    }
    trackFormFieldFocus('partnership_inquiry', fieldName);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const partnershipType = (data.get('partnership_type') as string) || 'not_sure';
    const budgetRange = (data.get('budget_range') as string) || 'prefer_to_discuss';
    const companyName = (data.get('company_name') as string) || 'Unknown';

    trackFormComplete({
      form_name: 'partnership_inquiry',
      partnership_type: partnershipType,
      budget_range: budgetRange,
      company_name: companyName,
    });

    const leadId = `LEAD-${Date.now().toString(36).toUpperCase()}`;
    const tier = qualifyLead(partnershipType, budgetRange);

    trackLeadQualify({
      lead_id: leadId,
      qualification_tier: tier,
      partnership_type: partnershipType,
      budget_range: budgetRange,
    });

    router.push('/demo/leadgen/thanks');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="your_name" className="block text-sm font-medium text-neutral-700">
          Your Name
        </label>
        <input
          id="your_name"
          name="your_name"
          type="text"
          defaultValue="Demo User"
          onFocus={() => handleFocus('name')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="company_name" className="block text-sm font-medium text-neutral-700">
          Company Name
        </label>
        <input
          id="company_name"
          name="company_name"
          type="text"
          defaultValue="Demo Corp"
          onFocus={() => handleFocus('company')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue="demo@example.com"
          onFocus={() => handleFocus('email')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="partnership_type" className="block text-sm font-medium text-neutral-700">
          Partnership Type
        </label>
        <select
          id="partnership_type"
          name="partnership_type"
          defaultValue="sponsored_content"
          onFocus={() => handleFocus('partnership_type')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          {partnershipTypes.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="budget_range" className="block text-sm font-medium text-neutral-700">
          Estimated Budget Range
        </label>
        <select
          id="budget_range"
          name="budget_range"
          defaultValue="15k_50k"
          onFocus={() => handleFocus('budget_range')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          {budgetRanges.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-neutral-700">
          Tell us about your brand and what you&apos;re looking for
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          defaultValue="We're interested in a partnership to reach pet lovers..."
          onFocus={() => handleFocus('message')}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
      >
        Start the Conversation
      </button>
      <p className="text-center text-xs text-neutral-400">
        No data is stored. This is a simulated inquiry for demonstration purposes.
      </p>
    </form>
  );
}
