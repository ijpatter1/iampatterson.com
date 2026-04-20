'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useOverlay } from '@/components/overlay/overlay-context';
import { useSessionState } from '@/components/session-state-provider';
import { trackClickCta, trackPortalClick } from '@/lib/events/track';
import {
  ECOMMERCE_FUNNEL_SEQUENCE,
  type EcommerceStage,
  type SessionState,
} from '@/lib/session-state/types';

const BAR_WIDTH = 16;
const EVENT_TYPE_THRESHOLD = 10;

type PortalDestination = 'services' | 'about' | 'contact';

const PORTAL_LINKS: { destination: PortalDestination; href: string; label: string }[] = [
  { destination: 'services', href: '/services', label: '> SERVICES' },
  { destination: 'about', href: '/about', label: '> ABOUT' },
  { destination: 'contact', href: '/contact', label: '> CONTACT' },
];

const STAGE_LABELS: Record<EcommerceStage, string> = {
  product_view: 'PRODUCT_VIEW',
  add_to_cart: 'ADD_TO_CART',
  begin_checkout: 'CHECKOUT',
  purchase: 'PURCHASE',
};

function shortSessionId(sid: string): string {
  // First 8 non-hyphen chars feel informative without dominating the layout.
  return sid.slice(0, 8);
}

function formatStartedAt(iso: string): string {
  try {
    const date = new Date(iso);
    // HH:MM:SS UTC — retrofuturist time stamp style, no locale drift.
    return date.toISOString().slice(11, 19);
  } catch {
    return iso;
  }
}

function renderBar(fired: number, total: number): string {
  if (total === 0) return '░'.repeat(BAR_WIDTH);
  const filled = Math.min(BAR_WIDTH, Math.round((fired / total) * BAR_WIDTH));
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}

function thresholdCrossed(state: SessionState): boolean {
  if (state.event_type_coverage.fired.length > EVENT_TYPE_THRESHOLD) return true;
  return state.demo_progress.ecommerce.stages_reached.includes('begin_checkout');
}

function Divider() {
  return (
    <div aria-hidden className="my-6 font-mono text-[11px] leading-none text-u-rule-soft">
      {'─'.repeat(48)}
    </div>
  );
}

function SectionKicker({ children }: { children: string }) {
  return (
    <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
      {children}
    </h3>
  );
}

export function SessionStateTab() {
  const state = useSessionState();
  const pathname = usePathname() ?? '/';
  const { close } = useOverlay();

  if (!state) {
    return (
      <div className="font-mono text-[12px] uppercase tracking-widest text-u-ink-3">
        Warming up session state…
      </div>
    );
  }

  const firedCount = state.event_type_coverage.fired.length;
  const totalCount = state.event_type_coverage.total.length;
  const bar = renderBar(firedCount, totalCount);
  const firedSet = new Set(state.event_type_coverage.fired);

  const handlePortalClick = (destination: PortalDestination) => {
    trackPortalClick(destination);
    close();
  };

  const handleContextualCtaClick = () => {
    trackClickCta('Seen enough? →', 'contact_cta_threshold');
    close();
  };

  return (
    <div data-testid="session-state-tab" className="space-y-6 text-sm text-u-ink">
      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
          Session State · Live
        </div>
        <dl className="space-y-1 font-mono text-xs">
          <div className="flex gap-3">
            <dt className="w-24 text-u-ink-3 uppercase tracking-widest text-[10px]">Session</dt>
            <dd className="text-accent-current">{shortSessionId(state.session_id)}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 text-u-ink-3 uppercase tracking-widest text-[10px]">Started</dt>
            <dd className="text-u-ink-2">{formatStartedAt(state.started_at)} UTC</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 text-u-ink-3 uppercase tracking-widest text-[10px]">Page</dt>
            <dd className="text-u-ink-2">{pathname}</dd>
          </div>
        </dl>
      </div>

      <Divider />

      <section>
        <SectionKicker>Event coverage</SectionKicker>
        <div className="mb-3 flex items-baseline gap-3 font-mono text-xs">
          <pre
            data-testid="coverage-bar"
            className="m-0 text-accent-current leading-none"
          >{`[${bar}]`}</pre>
          <span className="text-u-ink-2">
            {firedCount}/{totalCount} event types
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 font-mono text-[10px] sm:grid-cols-3">
          {state.event_type_coverage.total.map((name) => {
            const fired = firedSet.has(name);
            return (
              <div
                key={name}
                data-testid={`chip-${name}`}
                data-chip="event-chip"
                data-chip-name={name}
                data-fired={fired ? 'true' : 'false'}
                className={`border px-2 py-1 uppercase tracking-widest ${
                  fired
                    ? 'border-accent-current text-accent-current'
                    : 'border-u-rule-soft text-u-ink-3'
                }`}
              >
                {`> ${name}`}
              </div>
            );
          })}
        </div>
      </section>

      <Divider />

      <section>
        <SectionKicker>Ecommerce demo · Tier 2 + 3</SectionKicker>
        <ul className="space-y-1 font-mono text-xs">
          {ECOMMERCE_FUNNEL_SEQUENCE.map((stage) => {
            const reached = state.demo_progress.ecommerce.stages_reached.includes(stage);
            return (
              <li
                key={stage}
                data-testid="funnel-row"
                data-stage={stage}
                data-reached={reached ? 'true' : 'false'}
                className="flex gap-3"
              >
                <span className={reached ? 'text-accent-current' : 'text-u-ink-3'}>
                  {reached ? '[OK]' : '[  ]'}
                </span>
                <span className={reached ? 'text-u-ink-2' : 'text-u-ink-3'}>
                  {STAGE_LABELS[stage]}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-u-ink-3">
          {state.demo_progress.ecommerce.percentage}% complete
        </div>
      </section>

      <Divider />

      <section>
        <SectionKicker>Consent</SectionKicker>
        <dl className="space-y-1 font-mono text-xs">
          {(['analytics', 'marketing', 'preferences'] as const).map((signal) => {
            const value = state.consent_snapshot[signal];
            const granted = value === 'granted';
            return (
              <div key={signal} data-testid={`consent-row-${signal}`} className="flex gap-3">
                <dt className="w-28 text-u-ink-3 uppercase tracking-widest text-[10px]">
                  {signal}
                </dt>
                <dd className={granted ? 'text-accent-current' : 'text-u-ink-3'}>
                  {granted ? '[GRANTED]' : '[DENIED]'}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <Divider />

      <section>
        <SectionKicker>Explore the site</SectionKicker>
        <ul className="space-y-1 font-mono text-xs">
          {PORTAL_LINKS.map((link) => (
            <li key={link.destination}>
              <Link
                href={link.href}
                onClick={() => handlePortalClick(link.destination)}
                className="text-accent-current transition-opacity hover:opacity-80"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {thresholdCrossed(state) && (
        <div className="mt-2 border border-accent-current bg-u-paper-alt p-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent-current">
            Seen enough of the stack?
          </div>
          <Link
            href="/contact"
            data-testid="contextual-contact-cta"
            onClick={handleContextualCtaClick}
            className="font-display text-lg text-u-ink hover:text-accent-current"
          >
            Seen enough? →
          </Link>
        </div>
      )}
    </div>
  );
}
