'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

import { trackFormFieldFocus, trackFormStart, trackFormSubmit } from '@/lib/events/track';

export default function ContactPage() {
  const formStartedRef = useRef(false);
  const router = useRouter();

  function handleFieldFocus(fieldName: string) {
    if (!formStartedRef.current) {
      formStartedRef.current = true;
      trackFormStart('contact');
    }
    trackFormFieldFocus('contact', fieldName);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    trackFormSubmit('contact', true);
    router.push('/contact/thanks');
  }

  return (
    <main className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
          Let&#39;s talk about your measurement stack.
        </h1>

        <div className="mt-6 space-y-4 text-neutral-700">
          <p>
            I work with e-commerce brands, SaaS companies, marketing agencies, and mobile app
            companies that know their measurement infrastructure needs work but don&#39;t have the
            in-house expertise to fix it.
          </p>
          <p>
            If you&#39;re not sure where to start, that&#39;s fine. Most engagements begin with a
            conversation about what&#39;s broken, what&#39;s missing, and what you&#39;re trying to
            answer. From there, I&#39;ll scope the work and tell you honestly which tiers make sense
            for your situation — and which ones don&#39;t.
          </p>
        </div>

        <div className="mt-8">
          <p className="text-neutral-700">
            <strong>Email:</strong>{' '}
            <a
              href="mailto:ian@iampatterson.com"
              className="text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600"
            >
              ian@iampatterson.com
            </a>
          </p>
          <p className="mt-2 text-neutral-600">
            <strong>What to expect:</strong> I&#39;ll respond within 24 hours. If we&#39;re a good
            fit, we&#39;ll schedule a 30-minute call to discuss your current setup and goals. No
            proposals without a conversation first.
          </p>
        </div>

        <form className="mt-12 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-900">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              onFocus={() => handleFieldFocus('name')}
              className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-900">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              onFocus={() => handleFieldFocus('email')}
              className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-neutral-900">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              required
              onFocus={() => handleFieldFocus('message')}
              className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
          >
            Send Message
          </button>
        </form>
      </div>
    </main>
  );
}
