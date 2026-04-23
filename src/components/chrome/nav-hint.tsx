'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { NavHintDismissedEvent } from '@/lib/events/schema';
import { trackNavHintDismissed, trackNavHintShown } from '@/lib/events/track';

// Phase 9E D1 first-session hint: a one-time soft amber pulse ring expands
// outward from the SessionPulse after ~3s of homepage idle and auto-clears
// after ~10s of continued inactivity. Under prefers-reduced-motion the
// animated ring is replaced by static text ("← your session") that fades
// after 6s. Full contract in REQUIREMENTS.md Phase 9E D1.

type DismissalMode = NavHintDismissedEvent['dismissal_mode'];
type HintState = 'idle' | 'showing' | 'dismissed';

// sessionStorage gate: once-per-session. Set only when the hint actually
// renders (i.e. on the idle → showing transition), not on mount. A tab
// that never reaches the 3s idle threshold never sees the hint and the
// next homepage visit in the same session still gets a chance.
export const NAV_HINT_STORAGE_KEY = 'iampatterson.nav_hint.shown';

const IDLE_BEFORE_SHOW_MS = 3000;
const AUTO_CLEAR_MS = 10000;
const REDUCED_MOTION_FADE_MS = 6000;

function hasBeenShownThisSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(NAV_HINT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markShownThisSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(NAV_HINT_STORAGE_KEY, '1');
  } catch {
    // Strict-privacy sessionStorage can throw, fall back to letting
    // the hint re-trigger on a later homepage visit in this session.
  }
}

interface NavHintProps {
  /**
   * Ref to the SessionPulse element. Used only for dismissal
   * classification (SessionPulse-click → hide without dismissal event,
   * conversion tracked via click_cta; any other click → fire
   * `click_outside` dismissal). Three dismissal modes post-UAT per
   * `NavHintDismissedEvent.dismissal_mode` in the schema
   * (click_session_pulse removed, it was a conversion misclassified
   * as a dismissal mode).
   */
  sessionPulseRef: React.RefObject<HTMLElement | null>;
}

export function NavHint({ sessionPulseRef }: NavHintProps) {
  const pathname = usePathname();
  const [state, setState] = useState<HintState>('idle');
  // Mirror `state` into a ref so listeners added via useEffect, which
  // close over the initial state value, always see the current phase
  // without the effect having to re-register on every transition.
  const stateRef = useRef<HintState>('idle');
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Homepage-entry-scoped: hint only fires on `/` per spec. A visitor
    // entering at /services and later navigating to / sees it on that
    // first homepage visit; subsequent homepage visits within the same
    // session are suppressed by the sessionStorage gate.
    if (pathname !== '/') return;
    // Once-per-session gate.
    if (hasBeenShownThisSession()) return;

    let idleTimer: number | null = null;
    let autoClearTimer: number | null = null;

    const setPhase = (next: HintState) => {
      stateRef.current = next;
      setState(next);
    };

    const dismiss = (mode: DismissalMode) => {
      if (stateRef.current !== 'showing') return;
      setPhase('dismissed');
      if (autoClearTimer !== null) window.clearTimeout(autoClearTimer);
      trackNavHintDismissed(mode);
    };

    const show = () => {
      if (stateRef.current !== 'idle') return;
      markShownThisSession();
      setPhase('showing');
      trackNavHintShown();
      // Use a stable-at-capture-time reduced-motion read so the fade
      // timer matches the surface the visitor actually sees on this
      // transition. A reduced-motion toggle mid-display is a rare
      // edge case, fade duration stays committed for this hint
      // instance.
      const fadeMs =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? REDUCED_MOTION_FADE_MS
          : AUTO_CLEAR_MS;
      autoClearTimer = window.setTimeout(() => dismiss('timeout'), fadeMs);
    };

    const resetIdle = () => {
      if (stateRef.current !== 'idle') return;
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(show, IDLE_BEFORE_SHOW_MS);
    };

    const onScroll = () => {
      if (stateRef.current === 'showing') {
        dismiss('scroll');
      } else {
        resetIdle();
      }
    };

    const onClick = (e: MouseEvent) => {
      if (stateRef.current === 'showing') {
        const target = e.target as Node | null;
        const insidePulse = Boolean(
          target && sessionPulseRef.current && sessionPulseRef.current.contains(target),
        );
        if (insidePulse) {
          // Conversion, not a dismissal. Hide the hint visually but
          // don't fire nav_hint_dismissed, the click_cta(session_pulse)
          // emission already captures the outcome. Firing a "dismissal"
          // event for the intended call-to-action would conflate
          // conversions and abandonments in BI, making the dismissal
          // metric meaningless.
          setPhase('dismissed');
          if (autoClearTimer !== null) window.clearTimeout(autoClearTimer);
        } else {
          dismiss('click_outside');
        }
      } else {
        resetIdle();
      }
    };

    const onKeydown = () => {
      // keydown is part of the idle-detection surface but NOT a
      // dismissal trigger post-show (per UX_PIVOT_SPEC §3.1). A
      // visitor typing in a form while the hint is visible doesn't
      // dismiss it.
      if (stateRef.current === 'idle') resetIdle();
    };

    const onPointermove = () => {
      if (stateRef.current === 'idle') resetIdle();
    };

    document.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('pointermove', onPointermove);

    // Kick off the initial 3s idle window immediately on mount.
    resetIdle();

    return () => {
      document.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('pointermove', onPointermove);
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      if (autoClearTimer !== null) window.clearTimeout(autoClearTimer);
    };
  }, [pathname, sessionPulseRef]);

  if (state !== 'showing') return null;

  if (prefersReducedMotion) {
    return (
      <span
        data-testid="nav-hint"
        data-variant="static"
        role="status"
        className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-accent-current"
      >
        ← your session
      </span>
    );
  }

  return (
    <span
      data-testid="nav-hint"
      data-variant="pulse-ring"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -m-1 animate-nav-hint-ring rounded-full border border-accent-current"
    />
  );
}
