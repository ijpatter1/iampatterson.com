'use client';

import Link from 'next/link';

import { SessionPulse } from '@/components/chrome/session-pulse';
import { CONTACT_EMAIL } from '@/lib/content/contact';
import { trackClickCta, trackClickNav } from '@/lib/events/track';

const LINK_CLASSES =
  'inline-flex min-h-[44px] items-center text-sm text-ink-2 transition-colors hover:text-ink';

/**
 * One row (15.4): the wordmark, the contact page, the address and the session
 * readout. The header carries the way to the review and opens the overlay.
 */
export function Footer() {
  return (
    <footer className="border-t border-rule-soft bg-paper text-ink-2">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-8 gap-y-2 px-5 py-8 md:px-10">
        <Link
          href="/"
          onClick={() => trackClickNav('Patterson', '/')}
          className="inline-flex min-h-[44px] items-center font-display text-3xl text-ink transition-colors hover:text-accent-current"
        >
          Patterson<em className="not-italic text-accent-current">.</em>
        </Link>
        <Link
          href="/contact"
          onClick={() => trackClickCta('Contact', 'footer_contact')}
          className={LINK_CLASSES}
        >
          Contact
        </Link>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          onClick={() => trackClickCta(CONTACT_EMAIL, 'footer_email')}
          className={LINK_CLASSES}
        >
          {CONTACT_EMAIL}
        </a>
        <SessionPulse />
      </div>
    </footer>
  );
}
