'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { isPipelineEvent } from '@/lib/events/pipeline-schema';
import { readSessionCookie, subscribeSessionCookie } from '@/lib/events/session';

/**
 * - `connecting`: the first connection is under way.
 * - `connected`: a connection is open.
 * - `reconnecting`: a routine reconnect, such as the one after Cloud Run ends a
 *   stream at its hourly request timeout. Not a failure.
 * - `failing`: still retrying, but the stream is not working: it has gone
 *   `STREAM_FAILING_AFTER_MS` without an open connection, or it keeps opening
 *   and dropping (`STREAM_LOOP_DROPS` drops within `STREAM_LOOP_WINDOW_MS`).
 * - `disconnected`: given up, or not started.
 */
export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failing'
  | 'disconnected';

/**
 * Whether a reader should say the stream is not working. `off` is a stream
 * that is not configured (see `useLiveEvents`). A first connection under way
 * and a routine reconnect are not failures.
 */
export function isStreamDown(status: ConnectionStatus | 'off'): boolean {
  return status === 'off' || status === 'failing' || status === 'disconnected';
}

/**
 * How long the stream may go without an open connection before it counts as
 * failing. It covers a first connection that never opens, whether it errors or
 * hangs, and a reconnect that keeps failing. A routine reconnect reopens after
 * a one-second backoff and a Cloud Run cold start takes a few seconds, so
 * fifteen seconds clears both and still tells the visitor within a quarter of
 * a minute. The clock starts when the stream goes down and only an open stops
 * it, so retries do not restart it.
 */
export const STREAM_FAILING_AFTER_MS = 15_000;

/**
 * Drops of an opened connection, within `STREAM_LOOP_WINDOW_MS`, that make a
 * loop. A loop never trips the timer above, because each reopen succeeds.
 * Cloud Run's hourly ends are an hour apart, so they never meet in the window;
 * three rather than two leaves room for one unrelated drop, such as a deploy,
 * near a routine one. A loop that drops every couple of seconds reaches three
 * in a few seconds; one slower than about a drop every 30 seconds is not
 * flagged.
 *
 * Two tabs on one session are not a loop: the stream service keeps one
 * connection per tab and sends the session's events to each (connections.ts).
 * It ends a session's oldest connection only past its per-session cap, so a
 * page that opened more than that many streams would loop, and this rule
 * would catch it.
 *
 * Within a loop, an open does not reset the retry count, so the backoff grows
 * and the hook gives up after `maxRetries`.
 */
export const STREAM_LOOP_DROPS = 3;
export const STREAM_LOOP_WINDOW_MS = 60_000;

/**
 * How long a reopened connection must stay open to end a loop. A connection
 * that holds this long is delivering, and holding `failing` on it would put a
 * "last events it delivered" note over rows that are still updating. The opens
 * inside a loop seen so far last about a second, so ten seconds is several of
 * them. Settling clears `failing`, the drop history and the retry count.
 */
export const STREAM_SETTLE_MS = 10_000;

const NO_EVENTS: PipelineEvent[] = [];

function getServerSessionSnapshot(): string | null {
  return null;
}

const FAILING_ERROR = 'Live stream failing, still retrying';

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
  /** The session the current connection was opened for, or null before one. */
  sessionId: string | null;
}

export function useEventStream({
  url,
  maxBufferSize = 100,
  enabled = true,
  maxRetries = 5,
}: UseEventStreamOptions): UseEventStreamReturn {
  // An enabled stream starts as `connecting`, not `disconnected`: before the
  // connect effect runs it has not tried yet, and a down state on the first
  // render would flash the panel's note and announce it. If there turns out
  // to be no session cookie, the effect reports `disconnected`.
  const [status, setStatus] = useState<ConnectionStatus>(enabled ? 'connecting' : 'disconnected');
  const [error, setError] = useState<string | null>(null);

  // The stream follows the session cookie. The session it connects under is
  // read from the cookie store, so a new ID changes `session` in the same
  // render that triggers the connect effect's cleanup and reconnect. A new
  // value starts a new stream: the effect re-runs, so the loop history, the
  // retry count and `failing` start over. It is sticky through a missing
  // cookie: a deleted cookie keeps the last session until the site writes
  // the next ID. `setSessionCookie` notifies on a change from this tab's last
  // known value, and `session.ts` re-checks the jar when the tab is shown or
  // focused, so a rotation made in another tab is followed too.
  //
  // Why (2026-11-14): a first visit's "Allow all" made Cookiebot delete
  // `_iap_sid`, which its scan had filed as Unclassified, and the site's next
  // `getSessionId()` minted a new ID. The stream stayed on the old ID and
  // received nothing more until a reload. Ian reclassified the cookie as
  // Necessary that day; the session still changes after 30 minutes idle.
  const cookieSession = useSyncExternalStore(
    subscribeSessionCookie,
    readSessionCookie,
    getServerSessionSnapshot,
  );
  const [lastSession, setLastSession] = useState<string | null>(null);
  if (cookieSession && cookieSession !== lastSession) setLastSession(cookieSession);
  const session = cookieSession ?? lastSession;

  // The buffer records the session its events belong to. Events are returned
  // only for the current session, so in the render where the session
  // changes the old session's rows are already gone.
  const [buffer, setBuffer] = useState<{ session: string | null; events: PipelineEvent[] }>({
    session: null,
    events: NO_EVENTS,
  });
  const events = buffer.session === session ? buffer.events : NO_EVENTS;
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
  // True once the connect effect has used up its retries: no attempt in
  // flight and none scheduled. Written only from the connect effect's
  // callbacks; read by the `online` listener.
  const gaveUpRef = useRef(false);

  const clearEvents = useCallback(() => setBuffer((prev) => ({ ...prev, events: NO_EVENTS })), []);

  // D5: Online-event recovery. When the browser transitions offline
  // → online after the stream has given up, bump the retry trigger to force a
  // fresh connect. A stream that is still trying is left alone, open or not:
  // some browsers fire `online` spuriously on network hand-offs, and a
  // restart would throw away the attempt in flight, the backoff and a loop's
  // history, so a failing loop could never reach `disconnected`.
  useEffect(() => {
    function handleOnline(): void {
      if (gaveUpRef.current) {
        setRetryTrigger((n) => n + 1);
      }
    }
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Why the disable: setStatus('disconnected') is an external-signal
  // sync , reflecting `enabled=false` or missing-session-cookie into
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

    if (!session) {
      // Hydration renders with no cookie (the server has none), and the
      // cookie store reports the real value a render later. A cookie the
      // store has not reported yet is not a missing session.
      if (!readSessionCookie()) setStatus('disconnected');
      return;
    }
    const connectionSession = session;
    setBuffer((prev) =>
      prev.session === connectionSession ? prev : { session: connectionSession, events: NO_EVENTS },
    );

    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}session_id=${encodeURIComponent(connectionSession)}`;

    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let es: EventSource | null = null;
    let closed = false;
    // Failure detection; see STREAM_FAILING_AFTER_MS, STREAM_LOOP_DROPS and
    // STREAM_SETTLE_MS. Once failing, the status stays `failing` across
    // retries and short reopens, so the panel's note does not flash off and on
    // with each attempt.
    let failing = false;
    let failTimer: ReturnType<typeof setTimeout> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let drops: number[] = [];
    // The error path of an attempt that has neither opened nor failed yet.
    let abandonAttempt: (() => void) | null = null;

    function markFailing(): void {
      failing = true;
      setStatus('failing');
      setError(FAILING_ERROR);
    }

    function startFailTimer(): void {
      if (failTimer) return;
      failTimer = setTimeout(() => {
        failTimer = null;
        markFailing();
        // An attempt that has neither opened nor errored by now is a dead
        // socket: close it and retry, rather than wait on it.
        abandonAttempt?.();
      }, STREAM_FAILING_AFTER_MS);
    }

    function stopFailTimer(): void {
      if (failTimer) clearTimeout(failTimer);
      failTimer = null;
    }

    function inLoop(): boolean {
      const now = Date.now();
      drops = drops.filter((t) => now - t < STREAM_LOOP_WINDOW_MS);
      return drops.length >= STREAM_LOOP_DROPS;
    }

    function markConnected(): void {
      failing = false;
      retryCount = 0;
      setStatus('connected');
      setError(null);
    }

    function connect(): void {
      if (closed) return;

      if (!failing) {
        setStatus(retryCount === 0 ? 'connecting' : 'reconnecting');
        setError(null);
      }
      startFailTimer();

      let opened = false;
      es = new EventSource(fullUrl);

      function fail(): void {
        abandonAttempt = null;
        es?.close();
        es = null;

        if (closed) return;

        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = null;
        if (opened) drops.push(Date.now());
        if (inLoop()) failing = true;

        retryCount++;
        if (retryCount > maxRetries) {
          stopFailTimer();
          gaveUpRef.current = true;
          setStatus('disconnected');
          setError('EventSource connection failed after max retries');
          return;
        }

        startFailTimer();
        setStatus(failing ? 'failing' : 'reconnecting');
        setError(failing ? FAILING_ERROR : 'Connection lost, retrying...');
        // D5: ±20% jitter on the exponential backoff. Without jitter a
        // wave of clients that drop simultaneously (e.g. backend rolling
        // restart or a shared network blip) would all reconnect at the
        // same delays and thundering-herd the server on recovery. The
        // factor range 0.8-1.2 is the standard AWS/Google SRE jitter
        // band , small enough not to noticeably delay individual
        // clients, wide enough to spread the reconnect distribution.
        const baseDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
        const jitterFactor = 0.8 + Math.random() * 0.4;
        const delay = baseDelay * jitterFactor;
        retryTimer = setTimeout(connect, delay);
      }
      abandonAttempt = fail;

      es.onopen = () => {
        opened = true;
        abandonAttempt = null;
        stopFailTimer();
        if (inLoop()) {
          // A reopen inside a loop: stay failing and keep the retry count, so
          // the backoff keeps growing. Only a connection that stays open for
          // STREAM_SETTLE_MS ends the loop.
          markFailing();
          settleTimer = setTimeout(() => {
            settleTimer = null;
            drops = [];
            markConnected();
          }, STREAM_SETTLE_MS);
          return;
        }
        markConnected();
      };

      es.onmessage = (event: MessageEvent) => {
        if (closed) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (!isPipelineEvent(parsed)) return;
        // The service routes by the payload's session_id; anything else is
        // not this connection's session.
        if (parsed.session_id !== connectionSession) return;

        setBuffer((prev) => {
          // A message from a connection whose session has been replaced.
          if (prev.session !== connectionSession) return prev;
          // Deduplicate by event_name + timestamp + page_path (catches both
          // Pub/Sub redelivery and duplicate GTM tags firing the same event)
          const isDupe = prev.events.some(
            (e) =>
              e.event_name === parsed.event_name &&
              e.timestamp === parsed.timestamp &&
              e.page_path === parsed.page_path,
          );
          if (isDupe) return prev;

          const next = [parsed, ...prev.events];
          return {
            session: prev.session,
            events:
              next.length > bufferSizeRef.current ? next.slice(0, bufferSizeRef.current) : next,
          };
        });
      };

      es.onerror = fail;
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      stopFailTimer();
      if (settleTimer) clearTimeout(settleTimer);
      gaveUpRef.current = false;
      es?.close();
    };
  }, [url, enabled, maxRetries, retryTrigger, session]);

  return { status, events, error, clearEvents, sessionId: enabled ? session : null };
}
