'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

import { useDataLayerEvents } from './useDataLayerEvents';
import { useEventStream } from './useEventStream';

export interface UseLiveEventsReturn {
  /** Merged event stream: SSE when connected, dataLayer otherwise. */
  events: PipelineEvent[];
  /** True when the SSE pipeline is the active source. */
  source: 'sse' | 'dataLayer';
  /**
   * State of the stream connection itself, whichever source is active. `off`
   * means no stream is configured. A reader uses this to tell "data-layer
   * events because the stream is down" from "data-layer events by design".
   */
  stream: 'off' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}

export interface UseLiveEventsOptions {
  /**
   * The visitor's analytics consent, when known. `denied` pins the source to
   * the data layer — see below. Undefined before the banner is answered;
   * guessing would be its own dishonesty, so the SSE preference stands.
   */
  analyticsConsent?: 'granted' | 'denied';
}

/**
 * Unified live event source. Prefers the real SSE pipeline when
 * NEXT_PUBLIC_EVENT_STREAM_URL is set AND events have flowed at least
 * once; falls back to polling window.dataLayer so visualizations always
 * have content. The sticky flag keeps the source from flipping back to
 * dataLayer if the SSE buffer is ever cleared mid-session.
 *
 * **A declining visitor is pinned to the data layer.** [14.1]'s consent gate
 * exempts exactly one tag — `GA4 - consent_update` carries "No consent
 * requirement — consent_update must fire regardless of consent state" — so for
 * a decliner that single event is the only one that reaches the server, returns
 * over SSE, and flips the sticky latch below. Every data-layer event carrying
 * `blocked_consent` was then discarded for the rest of the session, leaving a
 * timeline showing one event beside a counter reporting nine, with the
 * explanatory empty state suppressed because the list was not empty.
 *
 * The data layer holds what the visitor actually did, already routed as
 * `blocked_consent` by `useDataLayerEvents`. Showing those events marked
 * blocked is the transparency this overlay exists for; an empty panel is
 * indistinguishable from a broken one.
 *
 * Only reproducible where NEXT_PUBLIC_EVENT_STREAM_URL is set — production.
 * Local development has no SSE, so the fallback already applied and it looked
 * correct, which is why no test caught it before `useLiveEvents.test.ts`.
 */
export function useLiveEventsSource(options: UseLiveEventsOptions = {}): UseLiveEventsReturn {
  const { analyticsConsent } = options;
  const baseUrl = process.env.NEXT_PUBLIC_EVENT_STREAM_URL ?? '';
  const eventStreamUrl = baseUrl.endsWith('/events') ? baseUrl : `${baseUrl}/events`;
  const sseEnabled = baseUrl.length > 0;

  const { events: sseEvents, status: sseStatus } = useEventStream({
    url: eventStreamUrl,
    enabled: sseEnabled,
  });
  const { events: dlEvents } = useDataLayerEvents();

  // Sticky "has SSE ever delivered?" latch. Once flipped true, stays
  // true for the session so the source doesn't flap back to dataLayer
  // when the SSE buffer is later cleared (e.g. clearEvents from
  // session-state reset). Converted from ref to state so the
  // render-time read below doesn't trip `react-hooks/refs`.
  const [sseEverDelivered, setSseEverDelivered] = useState(false);
  useEffect(() => {
    if (sseEnabled && sseEvents.length > 0 && !sseEverDelivered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sticky latch (see comment above)
      setSseEverDelivered(true);
    }
  }, [sseEnabled, sseEvents.length, sseEverDelivered]);

  // A decliner's events never reach the server, so SSE can only ever offer the
  // one exempt tag. Pin to the data layer rather than let that single event
  // latch the source.
  const useSse =
    analyticsConsent !== 'denied' && sseEnabled && (sseEvents.length > 0 || sseEverDelivered);
  const events = useSse ? sseEvents : dlEvents;
  const source = useSse ? 'sse' : 'dataLayer';
  const stream = sseEnabled ? sseStatus : 'off';
  // Stable while nothing changed: this object is a context value, and a fresh
  // one on every render would re-render every reader.
  return useMemo(() => ({ events, source, stream }), [events, source, stream]);
}

/**
 * The page's one live event source, provided by `LiveEventsProvider`.
 *
 * It is shared because the stream service keeps a single connection per
 * session: a second connection for the same session ends the first. Every
 * component that opened its own stream would take the feed away from the
 * others, so exactly one place opens it and everything else reads from here.
 */
export const LiveEventsContext = createContext<UseLiveEventsReturn | null>(null);

/**
 * Read the visitor's live events. Takes no options: consent is resolved once,
 * where the source is opened.
 */
export function useLiveEvents(): UseLiveEventsReturn {
  const value = useContext(LiveEventsContext);
  if (value === null) {
    throw new Error('useLiveEvents must be used inside <LiveEventsProvider>');
  }
  return value;
}
