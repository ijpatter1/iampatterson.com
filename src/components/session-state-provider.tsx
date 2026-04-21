'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getSessionId } from '@/lib/events/session';
import { getCurrentConsent, trackCoverageMilestone } from '@/lib/events/track';
import {
  createInitialSessionState,
  deriveNext,
  isKnownEventName,
  reconcileRehydrated,
  type SessionStateEventInput,
} from '@/lib/session-state/derive';
import { loadSessionState, saveSessionState } from '@/lib/session-state/storage';
import type { SessionState } from '@/lib/session-state/types';

const SessionStateContext = createContext<SessionState | null>(null);

const POLL_INTERVAL_MS = 400;

// A prior F8 iteration eager-loaded the persisted blob via
// `useState(initialLoad)` to eliminate the "Warming up…" flash on
// refresh. That broke hydration: the SSR render had state=null (window
// undefined → initialLoad returned null), the client first render had
// state=loaded blob, and every SSR'd consumer (SessionPulse, LiveStrip,
// ride-along) rendered different text content → React hydration error.
// Reverted to `useState(null)` + post-mount useEffect load; brief flash
// beats error-dialog UX in dev.

function toEventInput(entry: Record<string, unknown>): SessionStateEventInput | null {
  if (entry.iap_source !== true) return null;
  const event = entry.event;
  if (typeof event !== 'string' || !isKnownEventName(event)) return null;
  return {
    event,
    timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString(),
    page_path: typeof entry.page_path === 'string' ? entry.page_path : '',
    consent_analytics: entry.consent_analytics === true,
    consent_marketing: entry.consent_marketing === true,
    consent_preferences: entry.consent_preferences === true,
  };
}

export function SessionStateProvider({ children }: { children: ReactNode }) {
  // Initial state = null on both SSR and client-first-render so hydration
  // never mismatches. Post-mount useEffect loads the persisted blob and
  // re-renders with real data. Consumers that render SSR-side (Header's
  // SessionPulse + LiveStrip, /contact ride-along) fall through to their
  // null-state rendering on SSR + first client render; the subsequent
  // re-render paints the loaded state.
  const [state, setState] = useState<SessionState | null>(null);
  const [ready, setReady] = useState(false);
  const cursorRef = useRef(0);
  const milestonesEmittedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const sessionId = getSessionId();
    const loaded = loadSessionState();
    const initial = loaded
      ? reconcileRehydrated(loaded, sessionId)
      : createInitialSessionState(sessionId, new Date(), { consent: getCurrentConsent() });
    setState(initial);
    // Pre-populate the emitted-ref with any milestones the rehydrated blob
    // already contains so the effect doesn't re-fire them on mount.
    for (const t of initial.coverage_milestones_fired) milestonesEmittedRef.current.add(t);
    // Skip the write when reconciliation was a no-op (reference-equal to loaded).
    if (initial !== loaded) saveSessionState(initial);
    setReady(true);
  }, []);

  // Emit coverage_milestone events for newly-appearing entries. Ref-based de-dup
  // handles strict-mode double-invocation and any future state-path that could
  // add an entry twice.
  useEffect(() => {
    if (!state) return;
    for (const t of state.coverage_milestones_fired) {
      if (!milestonesEmittedRef.current.has(t)) {
        milestonesEmittedRef.current.add(t);
        trackCoverageMilestone(t);
      }
    }
  }, [state]);

  useEffect(() => {
    if (!ready) return;

    // Re-seed consent_snapshot on the first poll tick. Cookiebot's script loads
    // async from <head>; on a slow first visit it may not have populated by the
    // time the mount effect runs getCurrentConsent(). A re-read ~400ms later
    // catches the common case; the existing reducer self-heals from any event
    // thereafter.
    let reseededConsent = false;

    const interval = window.setInterval(() => {
      if (!window.dataLayer) return;
      const dl = window.dataLayer;

      const inputs: SessionStateEventInput[] = [];
      while (cursorRef.current < dl.length) {
        const entry = dl[cursorRef.current] as Record<string, unknown>;
        cursorRef.current++;
        const input = toEventInput(entry);
        if (input) inputs.push(input);
      }

      const consentReseedPending = !reseededConsent;
      if (consentReseedPending) reseededConsent = true;

      if (inputs.length === 0 && !consentReseedPending) return;

      // Apply reseed + events inside a single setState so the tick produces at
      // most one sessionStorage write even when both paths fire together.
      setState((prev) => {
        if (!prev) return prev;
        let next = prev;

        if (consentReseedPending) {
          const current = getCurrentConsent();
          const nextSnap = {
            analytics: current.consent_analytics ? ('granted' as const) : ('denied' as const),
            marketing: current.consent_marketing ? ('granted' as const) : ('denied' as const),
            preferences: current.consent_preferences ? ('granted' as const) : ('denied' as const),
          };
          const s = prev.consent_snapshot;
          const consentChanged =
            s.analytics !== nextSnap.analytics ||
            s.marketing !== nextSnap.marketing ||
            s.preferences !== nextSnap.preferences;
          if (consentChanged) {
            next = { ...next, consent_snapshot: nextSnap, updated_at: new Date().toISOString() };
          }
        }

        if (inputs.length > 0) {
          next = inputs.reduce((acc, e) => deriveNext(acc, e), next);
        }

        if (next !== prev) saveSessionState(next);
        return next;
      });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [ready]);

  return <SessionStateContext.Provider value={state}>{children}</SessionStateContext.Provider>;
}

/**
 * Read the current SessionState.
 *
 * Returns `null` in two observationally-identical cases: (1) the component is
 * outside a `SessionStateProvider`, and (2) the provider is mounted but its
 * init effect hasn't resolved yet (SSR, first paint). Consumers must handle
 * `null` anyway because of case (2), so this hook deliberately does NOT throw
 * on a missing provider the way `useOverlay` does, doing so would force
 * every consumer to choose between an SSR-safe null-check and a throw-guard.
 */
export function useSessionState(): SessionState | null {
  return useContext(SessionStateContext);
}
