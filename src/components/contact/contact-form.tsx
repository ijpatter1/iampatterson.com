'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SessionStateRideAlong } from '@/components/contact/session-state-ride-along';
import { SMALL_BODY_CLASSES } from '@/components/home/section';
import { CONTACT_CONFIG } from '@/lib/contact/config';
import { getRecaptchaToken, loadRecaptcha } from '@/lib/contact/recaptcha-client';
import { CONTACT_COPY, CONTACT_EMAIL } from '@/lib/content/contact';
import { trackFormFieldFocus, trackFormStart, trackFormSubmit } from '@/lib/events/track';

const FIELD_CLASSES =
  'mt-1.5 block w-full rounded-sm border border-rule-soft bg-paper px-4 py-2.5 text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20';
const FIELD_LABEL_CLASSES = 'block font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2';

/**
 * The inquiry form. It posts to `/api/contact` (16.3) with a reCAPTCHA token,
 * and shows the thanks page only when the server accepts the message.
 */
export function ContactForm() {
  const formStartedRef = useRef(false);
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'sending' | 'failed'>('idle');

  function handleFieldFocus(fieldName: string) {
    if (!formStartedRef.current) {
      formStartedRef.current = true;
      trackFormStart('contact');
      // The spam check loads only once someone starts the form.
      loadRecaptcha().catch(() => {});
    }
    trackFormFieldFocus('contact', fieldName);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    const form = new FormData(e.currentTarget);
    try {
      const token = await getRecaptchaToken();
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          message: form.get('message'),
          session_state: form.get('session_state') ?? undefined,
          token,
        }),
      });
      if (!res.ok) throw new Error(`contact ${res.status}`);
      trackFormSubmit('contact', true);
      router.push('/contact/thanks');
    } catch {
      trackFormSubmit('contact', false);
      setStatus('failed');
    }
  }

  return (
    <form className="border border-rule-soft bg-paper p-6 md:p-8" onSubmit={handleSubmit}>
      <h2 className="mb-6 font-display text-2xl font-normal leading-tight text-ink">
        {CONTACT_COPY.formTitle}
      </h2>
      <div className="space-y-5">
        <div>
          <label htmlFor="name" className={FIELD_LABEL_CLASSES}>
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            maxLength={CONTACT_CONFIG.limits.name}
            required
            onFocus={() => handleFieldFocus('name')}
            className={FIELD_CLASSES}
          />
        </div>
        <div>
          <label htmlFor="email" className={FIELD_LABEL_CLASSES}>
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            maxLength={CONTACT_CONFIG.limits.email}
            required
            onFocus={() => handleFieldFocus('email')}
            className={FIELD_CLASSES}
          />
        </div>
        <div>
          <label htmlFor="message" className={FIELD_LABEL_CLASSES}>
            Message
          </label>
          <p id="message-hint" className={`mt-1.5 ${SMALL_BODY_CLASSES}`}>
            {CONTACT_COPY.messageHint}
          </p>
          <textarea
            id="message"
            name="message"
            aria-describedby="message-hint"
            maxLength={CONTACT_CONFIG.limits.message}
            rows={5}
            required
            onFocus={() => handleFieldFocus('message')}
            className={FIELD_CLASSES}
          />
        </div>
        <SessionStateRideAlong />
        {status === 'failed' && (
          <p role="alert" className="text-sm text-ink">
            {CONTACT_COPY.failed}{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        )}
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-sm border border-ink bg-ink px-5 py-3.5 text-sm font-semibold text-paper transition-all hover:bg-ink-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {status === 'sending' ? CONTACT_COPY.sending : CONTACT_COPY.submit}
        </button>
      </div>
    </form>
  );
}
