'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { readSessionCookie } from '@/lib/events/session';

import { useLiveEvents } from './useLiveEvents';

// Passive cookie read (no UUID generation / cookie refresh side-effects)
// via useSyncExternalStore. Distinct from useSessionId which actively
// creates a session cookie; this hook OBSERVES an existing session and
// returns '' when none is set, per the SessionContext.session_id
// contract above ("empty string on SSR / first client render").
const subscribeSessionCookie = () => () => {};
const getSessionCookieSnapshot = () => readSessionCookie() ?? '';
const getSessionCookieServerSnapshot = () => '';

export interface SessionContext {
  /** Real session_id from the _iap_sid cookie; empty string on SSR / first client render. */
  session_id: string;
  /** Name of the most recent event in the live stream, or '' if none seen yet. */
  last_event_name: string;
  /** ISO received_at of the most recent event, or '' if none. */
  last_event_at: string;
  /** Seconds since the most recent event (Math.floor). 0 when no events. */
  seconds_since_last_event: number;
  /** Total iap_source events observed in this session's live stream. */
  events_in_session: number;
  /** Count of add_to_cart events in the last 30 seconds, feeds volume_anomaly. */
  add_to_cart_in_last_30s: number;
  /** Consent snapshot from the latest event, defaulted to granted/denied when no events. */
  consent_analytics: boolean;
  consent_marketing: boolean;
}

const EMPTY_CONTEXT: SessionContext = {
  session_id: '',
  last_event_name: '',
  last_event_at: '',
  seconds_since_last_event: 0,
  events_in_session: 0,
  add_to_cart_in_last_30s: 0,
  consent_analytics: false,
  consent_marketing: false,
};

/**
 * Unified session-scoped live context for Phase 9F live sidebars. The three
 * ecommerce sidebars (staging-layer / data-quality / warehouse-write) all
 * need the same handful of session-and-event values so readouts reflect the
 * visitor's actual session rather than seed fixtures. This hook is the
 * single source.
 *
 * SSR-safe: session_id starts as '' on the server and first client render;
 * the cookie read is deferred to a post-mount effect to avoid hydration
 * mismatches. Consumers should handle the empty-string case (render the
 * seed placeholder instead of an SSR/CSR mismatch).
 */
/** Re-tick interval for the time-sensitive fields (seconds_since_last_event,
 * add_to_cart_in_last_30s). 5s is a useful cadence, fast enough that a
 * visitor watching idle freshness sees it tick up, slow enough that it
 * doesn't churn React reconciliation. 0 tick disables (tests supply their
 * own fakeTimer or don't care). */
const TIME_TICK_MS = 5_000;

export function useSessionContext(): SessionContext {
  const { events } = useLiveEvents();
  const sessionId = useSyncExternalStore(
    subscribeSessionCookie,
    getSessionCookieSnapshot,
    getSessionCookieServerSnapshot,
  );
  const [, setTick] = useState(0);

  // Force a re-render on a fixed interval so `seconds_since_last_event`
  // and `add_to_cart_in_last_30s` don't freeze between events. Without
  // this, a visitor sitting idle on the cart for 30s would keep seeing
  // "last add_to_cart 2s ago" because no events trigger a re-compute.
  // The tick runs only on the client (useEffect) and is cleared on
  // unmount; SSR is unaffected.
  useEffect(() => {
    const handle = setInterval(() => setTick((n) => n + 1), TIME_TICK_MS);
    return () => clearInterval(handle);
  }, []);

  // Not memoised on events/sessionId alone — the tick state above
  // forces a re-run on each interval, which is the POINT: the
  // `Date.now()` calls below compute time-window values
  // (`secondsSince`, `add_to_cart_in_last_30s`) against the current
  // wall-clock each render, so an idle visitor watching the Overview
  // tab sees the counters tick forward. This is a deliberate
  // "render IS the refresh" pattern; the `react-hooks/purity` rule
  // flags Date.now-in-render by default because it's an impure
  // input to React memoisation, but memoisation here would break
  // the UX. Disables are attached to each Date.now call.
  if (events.length === 0) {
    return { ...EMPTY_CONTEXT, session_id: sessionId };
  }
  const latest = events[0];
  const lastAt = latest.received_at || latest.timestamp;
  const lastMs = Date.parse(lastAt);
  const secondsSince = Number.isFinite(lastMs)
    ? // eslint-disable-next-line react-hooks/purity -- live-clock via setTick interval (see comment above)
      Math.max(0, Math.floor((Date.now() - lastMs) / 1000))
    : 0;

  // eslint-disable-next-line react-hooks/purity -- live-clock via setTick interval (see comment above)
  const cutoffMs = Date.now() - 30_000;
  const addToCartIn30s = events.filter(
    (e) => e.event_name === 'add_to_cart' && Date.parse(e.received_at) >= cutoffMs,
  ).length;

  return {
    session_id: sessionId,
    last_event_name: latest.event_name,
    last_event_at: lastAt,
    seconds_since_last_event: secondsSince,
    events_in_session: events.length,
    add_to_cart_in_last_30s: addToCartIn30s,
    consent_analytics: latest.consent.analytics_storage === 'granted',
    consent_marketing: latest.consent.ad_storage === 'granted',
  };
}
