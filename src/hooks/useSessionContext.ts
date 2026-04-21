'use client';

import { useEffect, useMemo, useState } from 'react';

import { readSessionCookie } from '@/lib/events/session';

import { useLiveEvents } from './useLiveEvents';

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
  /** Count of add_to_cart events in the last 30 seconds — feeds volume_anomaly. */
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
export function useSessionContext(): SessionContext {
  const { events } = useLiveEvents();
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const id = readSessionCookie();
    if (id) setSessionId(id);
  }, []);

  return useMemo<SessionContext>(() => {
    if (events.length === 0) {
      return { ...EMPTY_CONTEXT, session_id: sessionId };
    }
    const latest = events[0];
    const lastAt = latest.received_at || latest.timestamp;
    const lastMs = Date.parse(lastAt);
    const secondsSince = Number.isFinite(lastMs)
      ? Math.max(0, Math.floor((Date.now() - lastMs) / 1000))
      : 0;

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
  }, [events, sessionId]);
}
