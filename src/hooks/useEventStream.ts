'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { isPipelineEvent } from '@/lib/events/pipeline-schema';
import { readSessionCookie } from '@/lib/events/session';

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UseEventStreamOptions {
  /** URL of the Cloud Run SSE endpoint. */
  url: string;
  /** Maximum number of events to keep in the buffer. Default: 100. */
  maxBufferSize?: number;
  /** Set to false to prevent connecting. Default: true. */
  enabled?: boolean;
  /** Maximum reconnection attempts before giving up. Default: 5. */
  maxRetries?: number;
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
  maxRetries = 5,
}: UseEventStreamOptions): UseEventStreamReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Incremented by the `online` event listener to force a fresh reconnect
  // after an offline period. Included in the connect-effect's dep array
  // so a bump triggers the effect's cleanup (closes prior EventSource,
  // clears pending retry timer) + a fresh connect.
  const [retryTrigger, setRetryTrigger] = useState(0);
  // Mirror `maxBufferSize` into a ref so the long-lived EventSource
  // onmessage callback reads the latest value without the outer effect
  // needing to re-register on every prop change. Ref update runs in
  // an effect (not during render) to satisfy `react-hooks/refs`.
  const bufferSizeRef = useRef(maxBufferSize);
  useEffect(() => {
    bufferSizeRef.current = maxBufferSize;
  }, [maxBufferSize]);
  // Mirror `status` into a ref so the `online` listener can read it
  // without re-registering on every status transition. Known narrow
  // race acknowledged in Pass-1 Tech Minor #6: between a
  // `setStatus('disconnected')` inside onerror and this effect flushing
  // the ref, an `online` event could read the stale ref. In practice
  // `online` events are browser-triggered and the race window is
  // microseconds, so collisions are theoretical. A stricter pattern
  // (inline-setState-and-ref via a wrapper) is a carry-forward if
  // field data shows the race materializing.
  const statusRef = useRef<ConnectionStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearEvents = useCallback(() => setEvents([]), []);

  // D5 — Online-event recovery. When the browser transitions offline
  // → online, if we're currently not-connected, bump the retry trigger
  // to force a fresh connect. Guarded by status so a healthy connection
  // doesn't churn on every `online` event (some browsers fire `online`
  // spuriously on network hand-offs).
  useEffect(() => {
    function handleOnline(): void {
      if (statusRef.current === 'disconnected' || statusRef.current === 'reconnecting') {
        setRetryTrigger((n) => n + 1);
      }
    }
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Why the disable: setStatus('disconnected') is an external-signal
  // sync — reflecting `enabled=false` or missing-session-cookie into
  // the connection-status state. Both branches are legitimate
  // terminal paths where the effect short-circuits without opening
  // an EventSource; lifting to a derived computation would require
  // threading the gate through every consumer of `status`.
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external-signal sync (see comment above)
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

    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let es: EventSource | null = null;
    let closed = false;

    function connect(): void {
      if (closed) return;

      setStatus(retryCount === 0 ? 'connecting' : 'reconnecting');
      setError(null);

      es = new EventSource(fullUrl);

      es.onopen = () => {
        retryCount = 0;
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
          // Deduplicate by event_name + timestamp + page_path (catches both
          // Pub/Sub redelivery and duplicate GTM tags firing the same event)
          const isDupe = prev.some(
            (e) =>
              e.event_name === parsed.event_name &&
              e.timestamp === parsed.timestamp &&
              e.page_path === parsed.page_path,
          );
          if (isDupe) return prev;

          const next = [parsed, ...prev];
          return next.length > bufferSizeRef.current ? next.slice(0, bufferSizeRef.current) : next;
        });
      };

      es.onerror = () => {
        es?.close();
        es = null;

        if (closed) return;

        retryCount++;
        if (retryCount > maxRetries) {
          setStatus('disconnected');
          setError('EventSource connection failed after max retries');
          return;
        }

        setStatus('reconnecting');
        setError('Connection lost, retrying...');
        // D5 — ±20% jitter on the exponential backoff. Without jitter a
        // wave of clients that drop simultaneously (e.g. backend rolling
        // restart or a shared network blip) would all reconnect at the
        // same delays and thundering-herd the server on recovery. The
        // factor range 0.8-1.2 is the standard AWS/Google SRE jitter
        // band — small enough not to noticeably delay individual
        // clients, wide enough to spread the reconnect distribution.
        const baseDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
        const jitterFactor = 0.8 + Math.random() * 0.4;
        const delay = baseDelay * jitterFactor;
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [url, enabled, maxRetries, retryTrigger]);

  return { status, events, error, clearEvents };
}
