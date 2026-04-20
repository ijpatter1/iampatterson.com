'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
const TYPING_INTERVAL_MS = 24;

type PortalDestination = 'services' | 'about' | 'contact';
type StageStatus = 'reached' | 'skipped' | 'pending';

const PORTAL_LINKS: {
  destination: PortalDestination;
  href: string;
  label: string;
  descriptor: string;
}[] = [
  {
    destination: 'services',
    href: '/services',
    label: '> SERVICES',
    descriptor: '→ Four tiers of measurement infrastructure',
  },
  {
    destination: 'about',
    href: '/about',
    label: '> ABOUT',
    descriptor: '→ Ian, Tuna, and the backstory',
  },
  {
    destination: 'contact',
    href: '/contact',
    label: '> CONTACT',
    descriptor: '→ Start a conversation',
  },
];

// Funnel labels mirror the event-name literals shown in the chip grid above
// (`> product_view`, `> add_to_cart`). Consistent retrofuture-terminal idiom
// across both surfaces; a visitor reading the chip grid and the funnel sees
// the same tokens. Uppercase matches the spec's example funnel rows.
const STAGE_LABELS: Record<EcommerceStage, string> = {
  product_view: 'PRODUCT_VIEW',
  add_to_cart: 'ADD_TO_CART',
  begin_checkout: 'BEGIN_CHECKOUT',
  purchase: 'PURCHASE',
};

/** Last 6 hex chars of the UUID — matches SessionPulse and LiveStrip. */
function shortSessionId(sid: string): string {
  return sid ? sid.slice(-6) : '······';
}

/**
 * Classify a stage's status for funnel rendering:
 * - `reached` — the stage's trigger event fired this session.
 * - `skipped` — unreached, but a later stage in canonical order was reached
 *   (deep-linked visitor bypassed this stage by design).
 * - `pending` — unreached, and no later stage reached either.
 */
function getStageStatus(stage: EcommerceStage, reached: readonly EcommerceStage[]): StageStatus {
  if (reached.includes(stage)) return 'reached';
  const idx = ECOMMERCE_FUNNEL_SEQUENCE.indexOf(stage);
  const laterReached = ECOMMERCE_FUNNEL_SEQUENCE.slice(idx + 1).some((s) => reached.includes(s));
  return laterReached ? 'skipped' : 'pending';
}

const STAGE_STATUS_TAG: Record<StageStatus, string> = {
  reached: '[OK]',
  skipped: '[SKIPPED]',
  pending: '[  ]',
};

function useTypedCoverage(text: string): string {
  const [displayed, setDisplayed] = useState<string>('');
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Guard: don't consume the one-shot on an empty placeholder. SessionState
    // hydrates asynchronously in the provider, so the first render here has
    // `text === ''`; the real readout arrives on a subsequent render. Without
    // this guard the empty-text run flips `hasAnimated.current` and the real
    // readout would appear instantly (Pass 2 evaluator C1).
    if (!text) return;
    if (hasAnimated.current) {
      setDisplayed(text);
      return;
    }
    hasAnimated.current = true;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplayed(text);
      return;
    }
    setDisplayed('');
    let i = 0;
    const interval = window.setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) window.clearInterval(interval);
    }, TYPING_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [text]);

  return displayed;
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

  // Compute readout before the early return so useTypedCoverage always runs.
  const firedCount = state?.event_type_coverage.fired.length ?? 0;
  const totalCount = state?.event_type_coverage.total.length ?? 0;
  const coverageReadout = state ? `> ${firedCount}/${totalCount} event types` : '';
  const typedCoverage = useTypedCoverage(coverageReadout);

  if (!state) {
    return (
      <div className="font-mono text-[12px] uppercase tracking-widest text-u-ink-3">
        Warming up session state…
      </div>
    );
  }

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
          &gt; YOUR SESSION · LIVE
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
          <span data-testid="coverage-readout" className="text-u-ink-2">
            {typedCoverage}
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
            const status = getStageStatus(stage, state.demo_progress.ecommerce.stages_reached);
            const tagClass =
              status === 'reached'
                ? 'text-accent-current'
                : status === 'skipped'
                  ? 'text-u-ink-2'
                  : 'text-u-ink-3';
            const labelClass = status === 'pending' ? 'text-u-ink-3' : 'text-u-ink-2';
            return (
              <li
                key={stage}
                data-testid="funnel-row"
                data-stage={stage}
                data-reached={status === 'reached' ? 'true' : 'false'}
                data-status={status}
                className="flex gap-3"
              >
                {/* Fixed-width status column so `[SKIPPED]` and `[OK]` produce
                    aligned funnel-label columns — the retrofuture-terminal
                    vocabulary reads as a table, not a jagged list. */}
                <span className={`inline-block w-20 ${tagClass}`}>{STAGE_STATUS_TAG[status]}</span>
                <span className={labelClass}>{STAGE_LABELS[stage]}</span>
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
        <ul className="space-y-2 font-mono text-xs">
          {PORTAL_LINKS.map((link) => (
            <li
              key={link.destination}
              className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <Link
                href={link.href}
                onClick={() => handlePortalClick(link.destination)}
                className="text-accent-current transition-opacity hover:opacity-80 sm:w-32"
              >
                {link.label}
              </Link>
              <span className="text-u-ink-3">{link.descriptor}</span>
            </li>
          ))}
        </ul>
      </section>

      {thresholdCrossed(state) && (
        <div className="mt-2 border border-accent-current bg-u-paper-alt p-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent-current">
            &gt; COVERAGE THRESHOLD REACHED
          </div>
          <Link
            href="/contact"
            data-testid="contextual-contact-cta"
            onClick={handleContextualCtaClick}
            className="font-display text-lg text-u-ink hover:text-accent-current"
          >
            Seen enough? Let&apos;s talk →
          </Link>
        </div>
      )}
    </div>
  );
}
