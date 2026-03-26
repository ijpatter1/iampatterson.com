'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { isPipelineEvent } from '@/lib/events/pipeline-schema';
import { readSessionCookie } from '@/lib/events/session';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseEventStreamOptions {
  /** URL of the Cloud Run SSE endpoint. */
  url: string;
  /** Maximum number of events to keep in the buffer. Default: 100. */
  maxBufferSize?: number;
  /** Set to false to prevent connecting. Default: true. */
  enabled?: boolean;
}

export interface UseEventStreamReturn {
  /** Current connection status. */
  status: ConnectionStatus;
  /** Buffered pipeline events (most recent first). */
  events: PipelineEvent[];
  /** Last connection error, or null. */
  error: string | null;
  /** Clear the event buffer. */
  clearEvents: () => void;
}

export function useEventStream({
  url,
  maxBufferSize = 100,
  enabled = true,
}: UseEventStreamOptions): UseEventStreamReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bufferSizeRef = useRef(maxBufferSize);
  bufferSizeRef.current = maxBufferSize;

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      return;
    }

    const sessionId = readSessionCookie();
    if (!sessionId) {
      setStatus('disconnected');
      return;
    }

    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}session_id=${encodeURIComponent(sessionId)}`;

    setStatus('connecting');
    setError(null);

    const es = new EventSource(fullUrl);

    es.onopen = () => {
      setStatus('connected');
      setError(null);
    };

    es.onmessage = (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (!isPipelineEvent(parsed)) return;

      setEvents((prev) => {
        const next = [parsed, ...prev];
        return next.length > bufferSizeRef.current ? next.slice(0, bufferSizeRef.current) : next;
      });
    };

    es.onerror = () => {
      setStatus('disconnected');
      setError('EventSource connection failed');
      es.close();
    };

    return () => {
      es.close();
    };
  }, [url, enabled]);

  return { status, events, error, clearEvents };
}
