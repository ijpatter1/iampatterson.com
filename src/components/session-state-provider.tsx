'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getSessionId, readSessionCookie } from '@/lib/events/session';
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

/**
 * Eager client-side load. Runs during useState's lazy initializer so the
 * first client render already has the hydrated state — returning visitors
 * never flash the "Warming up…" placeholder on page refresh (F8 user report).
 *
 * SSR-safe: returns null when window is undefined. Hydration-safe: any
 * consumer that would differ between SSR and client (ride-along
 * checkbox, Overview tab chips) gates its render on `state != null`, so
 * the client-first-render producing populated state while the SSR pass
 * produced null reaches the same "render nothing" leaf on first paint.
 * The overlay surface is entirely client-only (opacity-0 until opened),
 * so its internal state differences don't affect hydration at all.
 *
 * Deliberately does NOT call `getSessionId()` here — that function
 * writes a cookie as a side effect, which is inappropriate during
 * React's render phase. Just reads the existing cookie; the provider's
 * mount effect below calls getSessionId (which may refresh the cookie)
 * and reconciles the state if needed.
 */
function initialLoad(): SessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const loaded = loadSessionState();
    if (!loaded) return null;
    const sid = readSessionCookie();
    return sid ? reconcileRehydrated(loaded, sid) : loaded;
  } catch {
    return null;
  }
}

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
  // Eager-load via lazy initializer: returning visitors get their
  // hydrated state on first render, no "Warming up…" flash (F8 fix).
  const [state, setState] = useState<SessionState | null>(initialLoad);
  const [ready, setReady] = useState(false);
  const cursorRef = useRef(0);
  const milestonesEmittedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // The lazy-init above may have loaded a blob but couldn't safely
    // call getSessionId() (which writes the cookie). Here we do the
    // side-effectful work: refresh the cookie, reconcile against it,
    // fill in a fresh state if no blob existed.
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
 * on a missing provider the way `useOverlay` does — doing so would force
 * every consumer to choose between an SSR-safe null-check and a throw-guard.
 */
export function useSessionState(): SessionState | null {
  return useContext(SessionStateContext);
}
