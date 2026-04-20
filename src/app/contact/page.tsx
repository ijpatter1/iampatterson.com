'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

import { ScrollReveal } from '@/components/scroll-reveal';
import { SessionStateRideAlong } from '@/components/contact/session-state-ride-along';
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
    <main className="px-6 py-section">
      <div className="section-container">
        <div className="grid gap-16 lg:grid-cols-2">
          {/* Left: context */}
          <div>
            <ScrollReveal>
              <h1 className="font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
                Let&apos;s talk about your measurement stack.
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="mt-8 space-y-5 text-lg leading-relaxed text-content-secondary">
                <p>
                  I work with e-commerce brands, SaaS companies, marketing agencies, and mobile app
                  companies that know their measurement infrastructure needs work but don&apos;t
                  have the in-house expertise to fix it.
                </p>
                <p>
                  If you&apos;re not sure where to start, that&apos;s fine. Most engagements begin
                  with a conversation about what&apos;s broken, what&apos;s missing, and what
                  you&apos;re trying to answer. From there, I&apos;ll scope the work and tell you
                  honestly which tiers make sense for your situation, and which ones don&apos;t.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <div className="mt-8 rounded-card bg-surface-alt p-6">
                <p className="text-content-secondary">
                  <strong className="text-content">Email:</strong>{' '}
                  <a
                    href="mailto:ian@iampatterson.com"
                    className="text-brand-500 underline underline-offset-4 transition-colors hover:text-brand-700"
                  >
                    ian@iampatterson.com
                  </a>
                </p>
                <p className="mt-3 text-sm text-content-muted">
                  <strong className="text-content-secondary">What to expect:</strong> I&apos;ll
                  respond within 24 hours. If we&apos;re a good fit, we&apos;ll schedule a 30-minute
                  call to discuss your current setup and goals. No proposals without a conversation
                  first.
                </p>
              </div>
            </ScrollReveal>
          </div>

          {/* Right: form */}
          <ScrollReveal delay={0.2} variant="slideLeft">
            <form
              className="rounded-card border border-border bg-surface p-8 shadow-card"
              onSubmit={handleSubmit}
            >
              <h2 className="mb-6 font-display text-lg font-semibold text-content">
                Send a message
              </h2>
              <div className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-content">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    onFocus={() => handleFieldFocus('name')}
                    className="mt-1.5 block w-full rounded-card border border-border bg-surface px-4 py-2.5 text-content placeholder:text-content-disabled focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-content">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    onFocus={() => handleFieldFocus('email')}
                    className="mt-1.5 block w-full rounded-card border border-border bg-surface px-4 py-2.5 text-content placeholder:text-content-disabled focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-content">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    onFocus={() => handleFieldFocus('message')}
                    className="mt-1.5 block w-full rounded-card border border-border bg-surface px-4 py-2.5 text-content placeholder:text-content-disabled focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <SessionStateRideAlong />
                <button
                  type="submit"
                  className="w-full rounded-card bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-neutral-800"
                >
                  Send Message
                </button>
              </div>
            </form>
          </ScrollReveal>
        </div>
      </div>
    </main>
  );
}
