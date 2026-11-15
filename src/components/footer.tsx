'use client';

import { CtaLink } from '@/components/cta-link';
import type { OverlayTab } from '@/components/overlay/overlay-context';
import { useOverlay } from '@/components/overlay/overlay-context';
import { CONTACT_EMAIL } from '@/lib/content/contact';
import { trackClickCta } from '@/lib/events/track';
import { PRACTICE_NAME } from '@/lib/seo/site';

const SESSION_LINKS: { label: string; tab: OverlayTab }[] = [
  { label: 'Overview', tab: 'overview' },
  { label: 'Live event stream', tab: 'timeline' },
  { label: 'Consent state', tab: 'consent' },
];

const TARGET_CLASSES = 'inline-flex min-h-[44px] items-center transition-colors hover:text-ink';

/**
 * One row, mono 10px (15.4, copy.md §Footer with the bundle corrections'
 * Contact link): the copyright, the address, Contact, the Session links that
 * open the overlay on their tab, and the stack line.
 */
export function Footer() {
  const { open } = useOverlay();

  const openOverlay = (label: string, tab: OverlayTab) => {
    trackClickCta(label, 'footer_session');
    open(tab);
  };

  return (
    <footer className="border-t border-rule-soft bg-paper text-ink-2">
      <div
        data-footer-row
        className="mx-auto flex max-w-content flex-wrap items-center gap-x-6 px-5 py-4 font-mono text-[10px] tracking-wide text-ink-3 md:justify-between md:px-10"
      >
        <span>© 2026 {PRACTICE_NAME}</span>
        <CtaLink
          href={`mailto:${CONTACT_EMAIL}`}
          ctaLocation="footer_email"
          className={TARGET_CLASSES}
        >
          {CONTACT_EMAIL}
        </CtaLink>
        <CtaLink href="/contact" ctaLocation="footer_contact" className={TARGET_CLASSES}>
          Contact
        </CtaLink>
        <span className="inline-flex flex-wrap items-center whitespace-pre">
          <span>Session: </span>
          {SESSION_LINKS.map(({ label, tab }, i) => (
            <span key={tab} className="inline-flex items-center whitespace-pre">
              {i > 0 && <span aria-hidden="true"> · </span>}
              <button
                type="button"
                onClick={() => openOverlay(label, tab)}
                className={TARGET_CLASSES}
              >
                {label}
              </button>
            </span>
          ))}
        </span>
        <span>Built on Next.js · GTM · sGTM · BigQuery · Dataform</span>
      </div>
    </footer>
  );
}
