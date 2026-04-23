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

/**
 * Unified live event source. Prefers the real SSE pipeline when
 * NEXT_PUBLIC_EVENT_STREAM_URL is set AND events have flowed at least
 * once; falls back to polling window.dataLayer so visualizations always
 * have content. The sticky flag keeps the source from flipping back to
 * dataLayer if the SSE buffer is ever cleared mid-session.
 */
export function useLiveEvents(): UseLiveEventsReturn {
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

  const useSse = sseEnabled && (sseEvents.length > 0 || sseEverDelivered);
  return {
    events: useSse ? sseEvents : dlEvents,
    source: useSse ? 'sse' : 'dataLayer',
  };
}
