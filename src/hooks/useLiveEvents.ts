'use client';

import { useEffect, useRef } from 'react';

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

  const sseEverDeliveredRef = useRef(false);
  useEffect(() => {
    if (sseEnabled && sseEvents.length > 0) {
      sseEverDeliveredRef.current = true;
    }
  }, [sseEnabled, sseEvents.length]);

  const useSse = sseEnabled && (sseEvents.length > 0 || sseEverDeliveredRef.current);
  return {
    events: useSse ? sseEvents : dlEvents,
    source: useSse ? 'sse' : 'dataLayer',
  };
}
