'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';

import { useDataLayerEvents } from '@/hooks/useDataLayerEvents';
import { getSessionId } from '@/lib/events/session';
import { trackSessionPulseHover } from '@/lib/events/track';

interface SessionPulseProps {
  /** When provided, renders a button that calls this on click. Otherwise renders a display-only span. */
  onClick?: () => void;
}

// Phase 9E D1: when the clickable variant is rendered, hovering it fires
// `session_pulse_hover` at most once per 60 seconds per session. Desktop
// only — coarse-pointer devices (phones, tablets) synthesize hover on tap,
// which would produce confounded "hovered but didn't click" signal.
const HOVER_DEBOUNCE_MS = 60_000;

/**
 * Live session indicator — pulsing dot + short session ID + event count.
 *
 * Clickable variant (header) opens the under-the-hood overlay and carries
 * the Phase 9E D1 hover affordance upgrades: tooltip label, ↗ glow on
 * hover, min 44×44px touch target, `session_pulse_hover` emission.
 * Display-only variant (footer, formerly mobile sheet) is a passive
 * status indicator — no hover affordance, no emission.
 *
 * Exported as forwardRef so the NavHint component can classify clicks
 * on this surface vs. elsewhere on the page.
 */
export const SessionPulse = forwardRef<HTMLElement, SessionPulseProps>(function SessionPulse(
  { onClick },
  ref,
) {
  const [sessionId, setSessionId] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const { events } = useDataLayerEvents();
  const lastHoverEmitRef = useRef<number>(0);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const shortId = sessionId ? sessionId.slice(-6) : '······';
  const count = events.length;

  const body = (
    <>
      <span
        className="relative inline-block h-2 w-2 rounded-full bg-accent-current"
        style={{ boxShadow: '0 0 0 0 color-mix(in oklab, var(--accent) 60%, transparent)' }}
      >
        <span className="absolute inset-0 animate-session-pulse rounded-full bg-accent-current" />
      </span>
      <span className="font-mono text-[11px] tracking-wide text-ink-3">
        ses <span className="text-ink">{shortId}</span> · {count} evt
      </span>
    </>
  );

  if (onClick) {
    const handlePointerEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
      // Suppress synthesized hover on touch devices. `pointerType` is
      // 'touch' for finger/stylus and 'mouse' for actual desktop hover.
      if (e.pointerType !== 'mouse') return;
      setIsHovered(true);
      const now = Date.now();
      if (now - lastHoverEmitRef.current >= HOVER_DEBOUNCE_MS) {
        lastHoverEmitRef.current = now;
        trackSessionPulseHover();
      }
    };

    return (
      <span className="relative inline-flex items-center">
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={onClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          aria-label="Look under the hood — live session"
          // min 44×44 touch/click target per UX_PIVOT_SPEC §3.1 desktop
          // treatment — `min-h-[44px]` + padding produces a rectangular
          // hitbox that satisfies WCAG 2.5.5 without forcing a visible
          // background on the affordance.
          className={`group inline-flex min-h-[44px] items-center gap-2 rounded-sm px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-current focus-visible:ring-offset-2 ${
            isHovered ? 'bg-paper-alt ring-1 ring-accent-current' : 'hover:bg-paper-alt'
          }`}
        >
          {body}
          <span
            aria-hidden="true"
            className={`text-[10px] text-accent-current transition-all ${
              isHovered ? 'translate-x-0.5 drop-shadow-[0_0_6px_var(--accent)]' : ''
            }`}
          >
            ↗
          </span>
        </button>
        {isHovered && (
          <span
            data-testid="session-pulse-tooltip"
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap border border-accent-current bg-paper px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-accent-current"
          >
            NAV · UNDER THE HOOD
          </span>
        )}
      </span>
    );
  }

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className="inline-flex items-center gap-2">
      {body}
    </span>
  );
});
