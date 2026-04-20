'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getSessionId } from '@/lib/events/session';
import { getCurrentConsent } from '@/lib/events/track';
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
  const [state, setState] = useState<SessionState | null>(null);
  const [ready, setReady] = useState(false);
  const cursorRef = useRef(0);

  useEffect(() => {
    const sessionId = getSessionId();
    const loaded = loadSessionState();
    const initial = loaded
      ? reconcileRehydrated(loaded, sessionId)
      : createInitialSessionState(sessionId, new Date(), { consent: getCurrentConsent() });
    setState(initial);
    // Skip the write when reconciliation was a no-op (reference-equal to loaded).
    if (initial !== loaded) saveSessionState(initial);
    setReady(true);
  }, []);

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

      if (!reseededConsent) {
        reseededConsent = true;
        const current = getCurrentConsent();
        setState((prev) => {
          if (!prev) return prev;
          const nextSnap = {
            analytics: current.consent_analytics ? ('granted' as const) : ('denied' as const),
            marketing: current.consent_marketing ? ('granted' as const) : ('denied' as const),
            preferences: current.consent_preferences ? ('granted' as const) : ('denied' as const),
          };
          const s = prev.consent_snapshot;
          if (
            s.analytics === nextSnap.analytics &&
            s.marketing === nextSnap.marketing &&
            s.preferences === nextSnap.preferences
          ) {
            return prev;
          }
          const next: SessionState = {
            ...prev,
            consent_snapshot: nextSnap,
            updated_at: new Date().toISOString(),
          };
          saveSessionState(next);
          return next;
        });
      }

      if (inputs.length === 0) return;

      setState((prev) => {
        if (!prev) return prev;
        const next = inputs.reduce((acc, e) => deriveNext(acc, e), prev);
        saveSessionState(next);
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
