'use client';

import { useEffect, useState } from 'react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

import { useDataLayerEvents } from './useDataLayerEvents';
import { useEventStream } from './useEventStream';

export interface UseLiveEventsReturn {
  /** Merged event stream: SSE when connected, dataLayer otherwise. */
  events: PipelineEvent[];
  /** True when the SSE pipeline is the active source. */
  source: 'sse' | 'dataLayer';
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
export function useLiveEvents(options: UseLiveEventsOptions = {}): UseLiveEventsReturn {
  const { analyticsConsent } = options;
  const baseUrl = process.env.NEXT_PUBLIC_EVENT_STREAM_URL ?? '';
  const eventStreamUrl = baseUrl.endsWith('/events') ? baseUrl : `${baseUrl}/events`;
  const sseEnabled = baseUrl.length > 0;

  const { events: sseEvents } = useEventStream({
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
  return {
    events: useSse ? sseEvents : dlEvents,
    source: useSse ? 'sse' : 'dataLayer',
  };
}
