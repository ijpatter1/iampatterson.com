'use client';

import Link from 'next/link';

import { DEMO_LINKS, NAV_LINKS } from '@/components/chrome/nav-links';
import { SessionPulse } from '@/components/chrome/session-pulse';
import type { OverlayTab } from '@/components/overlay/overlay-context';
import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta, trackClickNav } from '@/lib/events/track';

// Footer under-the-hood deep-links route to non-dashboards tabs; the Dashboards
// tab is reachable from overlay chrome directly.
type UndersideTab = Exclude<OverlayTab, 'dashboards'>;

const UNDER_THE_HOOD_LINKS: { label: string; tab: UndersideTab }[] = [
  { label: 'Live event stream', tab: 'timeline' },
  { label: 'Pipeline architecture', tab: 'overview' },
  { label: 'Consent state', tab: 'consent' },
];

export function Footer() {
  const { open } = useOverlay();

  const openOverlay = (label: string, tab: UndersideTab) => {
    trackClickCta(label, 'footer_under_the_hood');
    open(tab);
  };

  return (
    <footer className="border-t border-rule-soft bg-paper text-ink-2">
      <div className="mx-auto max-w-content px-5 py-14 md:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <h4 className="font-display text-3xl text-ink">
              Patterson<em className="not-italic text-accent-current">.</em>
            </h4>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-3">
              Measurement infrastructure for marketing teams. This site runs on the same stack I
              build for clients.
            </p>
            <div className="mt-5">
              <SessionPulse />
            </div>
          </div>

          <div>
            <h5 className="font-mono text-[10px] uppercase tracking-widest text-ink-3">Pages</h5>
            <ul className="mt-4 space-y-2">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => trackClickNav(l.label, l.href)}
                    className="text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="font-mono text-[10px] uppercase tracking-widest text-ink-3">Demos</h5>
            <ul className="mt-4 space-y-2">
              {DEMO_LINKS.map((d) => (
                <li key={d.href}>
                  <Link
                    href={d.href}
                    onClick={() => trackClickNav(d.title, d.href)}
                    className="text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
              Under the hood
            </h5>
            <ul className="mt-4 space-y-2">
              {UNDER_THE_HOOD_LINKS.map(({ label, tab }) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => openOverlay(label, tab)}
                    className="text-left text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col justify-between gap-2 border-t border-rule-soft pt-6 font-mono text-[10px] tracking-wide text-ink-3 md:flex-row">
          <span>© 2026 Patterson Consulting</span>
          <a
            href="mailto:ian@iampatterson.com"
            className="transition-colors hover:text-ink"
            onClick={() => trackClickNav('ian@iampatterson.com', 'mailto:ian@iampatterson.com')}
          >
            ian@iampatterson.com
          </a>
          <span>Built on Next.js · GTM · sGTM · BigQuery · Dataform</span>
        </div>
      </div>
    </footer>
  );
}
