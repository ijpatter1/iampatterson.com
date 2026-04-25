'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useOverlay } from '@/components/overlay/overlay-context';
import { useSessionState } from '@/components/session-state-provider';
import { RENDERABLE_EVENT_NAMES } from '@/lib/events/schema';
import { trackClickCta, trackPortalClick } from '@/lib/events/track';
import {
  ECOMMERCE_FUNNEL_SEQUENCE,
  type EcommerceStage,
  type SessionState,
} from '@/lib/session-state/types';

const BAR_WIDTH = 16;
// Restored to the spec's original 10 after user reported > 5 surfaced
// the CTA too aggressively (triggered at ~6-7 events fired during
// basic homepage exploration, consent_update + nav_hint_shown +
// session_pulse_hover + click_cta + overview_tab_view + a couple
// more). The earlier "CTA never shows" complaint was under > 10; the
// right balance per spec intent is visitor engaged with >10 distinct
// event types OR progressed to ecommerce `begin_checkout`. The OR
// branch fast-tracks engaged demo visitors; the >10 branch filters
// for genuine homepage engagement.
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
    descriptor: 'Four tiers of measurement infrastructure.',
  },
  {
    destination: 'about',
    href: '/about',
    label: '> ABOUT',
    descriptor: 'Ian, Tuna, and the backstory.',
  },
  {
    destination: 'contact',
    href: '/contact',
    label: '> CONTACT',
    descriptor: 'Start a conversation.',
  },
];

const STAGE_LABELS: Record<EcommerceStage, string> = {
  product_view: 'PRODUCT_VIEW',
  add_to_cart: 'ADD_TO_CART',
  begin_checkout: 'CHECKOUT',
  purchase: 'PURCHASE',
};

/** Last 6 hex chars of the UUID, matches SessionPulse and LiveStrip. */
function shortSessionId(sid: string): string {
  return sid ? sid.slice(-6) : '······';
}

/**
 * Classify a stage's status for funnel rendering:
 * - `reached`, the stage's trigger event fired this session.
 * - `skipped`, unreached, but a later stage in canonical order was reached
 *   (deep-linked visitor bypassed this stage by design).
 * - `pending`, unreached, and no later stage reached either.
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

/**
 * One-shot typewriter for the coverage-number readout. One-shot per
 * **component mount**, not per hydration. Under `prefers-reduced-motion`
 * the animation is skipped on the first call too.
 */
function useTypedCoverage(text: string): string {
  const [displayed, setDisplayed] = useState<string>('');
  const hasAnimated = useRef(false);

  // Why the disable: the effect IS the animation. `setDisplayed` drives
  // the typing reveal frame-by-frame via setInterval; the reduced-motion
  // branch short-circuits to the final value immediately. Either path
  // needs setState in the effect body — it's literally what the animation
  // is. Lifting to a derived computation would mean typing on every
  // render, which is the opposite of intent.
  useEffect(() => {
    // Don't consume the one-shot on an empty placeholder, SessionState
    // hydrates asynchronously, so the first render has `text === ''`.
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- animation driver (see comment above)
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

function SectionKicker({ children }: { children: string }) {
  return (
    <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-accent-current">
      {children}
    </h3>
  );
}

export function OverviewTab() {
  const state = useSessionState();
  const pathname = usePathname() ?? '/';
  const { close } = useOverlay();

  // Total + fired are derived from RENDERABLE_EVENT_NAMES, not the full
  // schema. Subscription + leadgen events stay in the data model for
  // future reintroduction but don't surface as chips today.
  const renderableSet = new Set<string>(RENDERABLE_EVENT_NAMES);
  const firedRenderable =
    state?.event_type_coverage.fired.filter((n) => renderableSet.has(n)) ?? [];
  const firedCount = firedRenderable.length;
  const totalCount = RENDERABLE_EVENT_NAMES.length;
  const coverageReadout = state ? `> ${firedCount}/${totalCount} event types` : '';
  const typedCoverage = useTypedCoverage(coverageReadout);

  if (!state) {
    return (
      <div className="font-mono text-xs uppercase tracking-widest text-u-ink-3">
        Warming up session state…
      </div>
    );
  }

  const bar = renderBar(firedCount, totalCount);
  const firedSet = new Set(firedRenderable);

  const handlePortalClick = (destination: PortalDestination) => {
    trackPortalClick(destination);
    close();
  };

  const handleContextualCtaClick = () => {
    // REQUIREMENTS.md deliverable 3 line 368: the contextual contact CTA
    // fires `portal_click(contact)` + a distinguishing `click_cta` with
    // `cta_location: 'contact_cta_threshold'`.
    trackPortalClick('contact');
    trackClickCta('Seen enough? →', 'contact_cta_threshold');
    close();
  };

  const thresholdHit = thresholdCrossed(state);

  return (
    <div data-testid="overview-tab" className="space-y-10 text-ink">
      {/* Phase 10d D8.h: directive block at the top of the tab, matching the
          Timeline and Consent tabs' pattern (eyebrow + headline + body). Gives
          the Overview its own tab-level intro instead of jumping straight into
          the Portals section. */}
      <section data-testid="overview-directive">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
          Session overview · live
        </div>
        <h3 className="font-display text-2xl font-normal leading-tight text-u-ink">
          Where you are in your session.
        </h3>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
          Event coverage, consent state, and ecommerce-demo progress for this session.
        </p>
      </section>

      {/* --- Portals + threshold CTA (TOP per UAT F1 feedback) --- */}
      <section data-testid="overview-portals">
        <SectionKicker>Explore the site</SectionKicker>
        <ul className="grid gap-3 sm:grid-cols-3">
          {PORTAL_LINKS.map((link) => (
            <li key={link.destination}>
              <Link
                href={link.href}
                data-testid={`portal-${link.destination}`}
                onClick={() => handlePortalClick(link.destination)}
                className="flex h-full flex-col gap-1 border border-u-rule-soft bg-u-paper-alt p-4 transition-colors hover:border-accent-current"
              >
                <span className="font-mono text-sm text-accent-current">{link.label}</span>
                <span className="text-sm text-u-ink-2">{link.descriptor}</span>
              </Link>
            </li>
          ))}
        </ul>

        {thresholdHit && (
          <div
            data-testid="contextual-contact-cta-block"
            className="mt-4 border border-accent-current bg-u-paper-alt p-4"
          >
            <div className="mb-2 font-mono text-xs uppercase tracking-widest text-accent-current">
              &gt; COVERAGE THRESHOLD REACHED
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
      </section>

      {/* --- Session header + consent (2-col on desktop per UAT F1 feedback) --- */}
      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <SectionKicker>Your session · live</SectionKicker>
          <dl className="space-y-2 font-mono text-sm">
            <div className="flex gap-3">
              <dt className="w-24 text-xs uppercase tracking-widest text-u-ink-3">Session</dt>
              <dd className="text-accent-current">{shortSessionId(state.session_id)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 text-xs uppercase tracking-widest text-u-ink-3">Started</dt>
              <dd className="text-u-ink-2">{formatStartedAt(state.started_at)} UTC</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 text-xs uppercase tracking-widest text-u-ink-3">Page</dt>
              <dd className="text-u-ink-2">{pathname}</dd>
            </div>
          </dl>
        </section>

        <section>
          <SectionKicker>Consent</SectionKicker>
          <dl className="space-y-2 font-mono text-sm">
            {(['analytics', 'marketing', 'preferences'] as const).map((signal) => {
              const value = state.consent_snapshot[signal];
              const granted = value === 'granted';
              return (
                <div key={signal} data-testid={`consent-row-${signal}`} className="flex gap-3">
                  <dt className="w-28 text-xs uppercase tracking-widest text-u-ink-3">{signal}</dt>
                  {/* Phase 10d D8.j: red/green accents + glyph for colour-blind
                      redundancy. Persimmon previously flagged "granted" but
                      denied fell to muted grey, which read as "unset", not
                      "blocked". `text-u-accept` (green) + `✓` now pair with
                      `text-u-deny` (red) + `×` so the binary reads as a
                      semantic pair, not an accent-vs-absence. */}
                  <dd
                    className={`flex items-center gap-1 ${granted ? 'text-u-accept' : 'text-u-deny'}`}
                  >
                    <span aria-hidden="true">{granted ? '✓' : '×'}</span>
                    <span>{granted ? '[GRANTED]' : '[DENIED]'}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>

      {/* --- Event coverage (full width) --- */}
      <section>
        <SectionKicker>Event coverage</SectionKicker>
        <div className="mb-3 flex flex-wrap items-baseline gap-3 font-mono text-sm">
          <pre
            data-testid="coverage-bar"
            className="m-0 leading-none text-accent-current"
          >{`[${bar}]`}</pre>
          <span data-testid="coverage-readout" className="text-u-ink-2">
            {typedCoverage}
          </span>
        </div>
        {/* F5 UAT S11, explicit min-w-0 + truncate + whitespace-nowrap
            keep each chip on a single line at 360px. Without min-w-0
            the grid cell's intrinsic width wins and the long chip names
            (e.g. `> session_pulse_hover`) overflow or wrap the leading
            `>` to its own line. */}
        <div className="grid grid-cols-2 gap-1 font-mono text-xs sm:grid-cols-3 md:grid-cols-4">
          {RENDERABLE_EVENT_NAMES.map((name) => {
            const fired = firedSet.has(name);
            return (
              <div
                key={name}
                data-testid={`chip-${name}`}
                data-chip="event-chip"
                data-chip-name={name}
                data-fired={fired ? 'true' : 'false'}
                className={`min-w-0 truncate whitespace-nowrap border px-2 py-1 uppercase tracking-wide ${
                  fired
                    ? 'border-accent-current text-accent-current'
                    : 'border-u-rule-soft text-u-ink-3'
                }`}
                title={name}
              >
                {`> ${name}`}
              </div>
            );
          })}
        </div>
      </section>

      {/* --- Ecommerce funnel (full width) --- */}
      <section>
        <SectionKicker>Ecommerce demo · Tier 2 + 3</SectionKicker>
        <ul className="space-y-2 font-mono text-sm">
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
                <span className={`inline-block w-20 ${tagClass}`}>{STAGE_STATUS_TAG[status]}</span>
                <span className={labelClass}>{STAGE_LABELS[stage]}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 font-mono text-xs uppercase tracking-widest text-u-ink-3">
          {state.demo_progress.ecommerce.percentage}% complete
        </div>
      </section>
    </div>
  );
}
