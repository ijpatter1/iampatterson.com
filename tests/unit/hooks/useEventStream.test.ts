/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import {
  isStreamDown,
  STREAM_FAILING_AFTER_MS,
  STREAM_LOOP_DROPS,
  STREAM_LOOP_WINDOW_MS,
  STREAM_SETTLE_MS,
  useEventStream,
} from '@/hooks/useEventStream';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { createPipelineEvent } from '@/lib/events/pipeline-schema';

// ---------------------------------------------------------------------------
// Mock SSE (EventSource)
// ---------------------------------------------------------------------------

type EventSourceListener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: EventSourceListener | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;

  /**
   * What the far end does with each new connection, for tests that need every
   * attempt to behave the same way. Null leaves each connection to the test.
   */
  static script: ((es: MockEventSource) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    MockEventSource.instances.push(this);
    MockEventSource.script?.(this);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2; // CLOSED
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(data: string): void {
    const event = new MessageEvent('message', { data });
    this.onmessage?.(event);
  }

  simulateError(): void {
    this.readyState = 2;
    this.onerror?.(new Event('error'));
  }
}

// Install mock
Object.defineProperty(globalThis, 'EventSource', {
  value: MockEventSource,
  writable: true,
});

// Mock session cookie
const mockSessionId = 'sess-test-123';
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => mockSessionId },
});

function setSessionCookie(id: string): void {
  document.cookie = `_iap_sid=${id}; Path=/`;
}

function clearCookies(): void {
  document.cookie = '_iap_sid=; Max-Age=0; Path=/';
}

function makePipelineEvent(overrides: Partial<PipelineEvent> = {}): PipelineEvent {
  return createPipelineEvent({
    session_id: mockSessionId,
    event_name: 'page_view',
    timestamp: new Date().toISOString(),
    page_path: '/',
    page_title: 'Home',
    page_location: 'https://example.com/',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing: [],
    ...overrides,
  });
}

beforeEach(() => {
  MockEventSource.instances = [];
  MockEventSource.script = null;
  clearCookies();
  setSessionCookie(mockSessionId);
});

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

describe('useEventStream connection lifecycle', () => {
  it('starts with disconnected status and empty buffer', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    expect(result.current.status).toBe('connecting');
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('creates an EventSource with the session ID in the URL', () => {
    renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(
      `http://localhost:8080/events?session_id=${mockSessionId}`,
    );
  });

  it('transitions to connected on open', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });
    expect(result.current.status).toBe('connected');
  });

  it('transitions to reconnecting on first error (not disconnected)', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });
    act(() => {
      MockEventSource.instances[0].simulateError();
    });
    expect(result.current.status).toBe('reconnecting');
    expect(result.current.error).toBeTruthy();
  });

  it('transitions to disconnected after max retries exhausted', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useEventStream({ url: 'http://localhost:8080/events', maxRetries: 2 }),
    );

    // First error → reconnecting (retry 1)
    act(() => {
      MockEventSource.instances[0].simulateError();
    });
    expect(result.current.status).toBe('reconnecting');

    // Advance timer for retry 1
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    // Second error → reconnecting (retry 2)
    act(() => {
      MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();
    });
    expect(result.current.status).toBe('reconnecting');

    // Advance timer for retry 2
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // Third error → exhausted, disconnected
    act(() => {
      MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();
    });
    expect(result.current.status).toBe('disconnected');
    expect(result.current.error).toContain('max retries');

    jest.useRealTimers();
  });

  it('resets retry count after successful reconnection', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useEventStream({ url: 'http://localhost:8080/events', maxRetries: 2 }),
    );

    // First error → reconnecting
    act(() => {
      MockEventSource.instances[0].simulateError();
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Reconnection succeeds
    act(() => {
      MockEventSource.instances[MockEventSource.instances.length - 1].simulateOpen();
    });
    expect(result.current.status).toBe('connected');

    // Another error → should start retry count from 0 again
    act(() => {
      MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();
    });
    expect(result.current.status).toBe('reconnecting');

    jest.useRealTimers();
  });

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
  });

  it('cancels pending retry on unmount', () => {
    jest.useFakeTimers();
    const { unmount } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));

    act(() => {
      MockEventSource.instances[0].simulateError();
    });
    const instanceCountBeforeUnmount = MockEventSource.instances.length;
    unmount();

    // Advance past retry delay, no new EventSource should be created
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(MockEventSource.instances.length).toBe(instanceCountBeforeUnmount);

    jest.useRealTimers();
  });

  it('does not connect when disabled', () => {
    renderHook(() => useEventStream({ url: 'http://localhost:8080/events', enabled: false }));
    expect(MockEventSource.instances).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Event buffering
// ---------------------------------------------------------------------------

describe('useEventStream event buffering', () => {
  it('adds incoming pipeline events to the buffer', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    const event = makePipelineEvent({ event_name: 'click_cta' });

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      MockEventSource.instances[0].simulateMessage(JSON.stringify(event));
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].event_name).toBe('click_cta');
  });

  it('prepends new events (most recent first)', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    const first = makePipelineEvent({ event_name: 'page_view' });
    const second = makePipelineEvent({ event_name: 'click_cta' });

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      MockEventSource.instances[0].simulateMessage(JSON.stringify(first));
      MockEventSource.instances[0].simulateMessage(JSON.stringify(second));
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0].event_name).toBe('click_cta');
    expect(result.current.events[1].event_name).toBe('page_view');
  });

  it('respects maxBufferSize and evicts oldest events', () => {
    const { result } = renderHook(() =>
      useEventStream({ url: 'http://localhost:8080/events', maxBufferSize: 2 }),
    );

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      for (let i = 0; i < 5; i++) {
        const event = makePipelineEvent({ event_name: `event_${i}` });
        MockEventSource.instances[0].simulateMessage(JSON.stringify(event));
      }
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0].event_name).toBe('event_4');
    expect(result.current.events[1].event_name).toBe('event_3');
  });

  it('defaults maxBufferSize to 100', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      for (let i = 0; i < 110; i++) {
        const event = makePipelineEvent({ event_name: `event_${i}` });
        MockEventSource.instances[0].simulateMessage(JSON.stringify(event));
      }
    });

    expect(result.current.events).toHaveLength(100);
    expect(result.current.events[0].event_name).toBe('event_109');
  });

  it('deduplicates events with same event_name, timestamp, and page_path', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    const ts = '2026-03-27T10:00:00.000Z';
    const event1 = makePipelineEvent({
      event_name: 'page_view',
      timestamp: ts,
      page_path: '/about',
    });
    const event2 = makePipelineEvent({
      event_name: 'page_view',
      timestamp: ts,
      page_path: '/about',
    });

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      MockEventSource.instances[0].simulateMessage(JSON.stringify(event1));
      MockEventSource.instances[0].simulateMessage(JSON.stringify(event2));
    });

    expect(result.current.events).toHaveLength(1);
  });

  it('does not deduplicate events with different timestamps', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    const event1 = makePipelineEvent({
      event_name: 'page_view',
      timestamp: '2026-03-27T10:00:00.000Z',
      page_path: '/',
    });
    const event2 = makePipelineEvent({
      event_name: 'page_view',
      timestamp: '2026-03-27T10:00:01.000Z',
      page_path: '/',
    });

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      MockEventSource.instances[0].simulateMessage(JSON.stringify(event1));
      MockEventSource.instances[0].simulateMessage(JSON.stringify(event2));
    });

    expect(result.current.events).toHaveLength(2);
  });

  it('ignores messages that are not valid PipelineEvents', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      MockEventSource.instances[0].simulateMessage('not json');
      MockEventSource.instances[0].simulateMessage(JSON.stringify({ foo: 'bar' }));
    });

    expect(result.current.events).toHaveLength(0);
  });

  it('exposes a clearEvents function that empties the buffer', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    const event = makePipelineEvent();

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      MockEventSource.instances[0].simulateMessage(JSON.stringify(event));
    });
    expect(result.current.events).toHaveLength(1);

    act(() => {
      result.current.clearEvents();
    });
    expect(result.current.events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Session scoping
// ---------------------------------------------------------------------------

describe('useEventStream session scoping', () => {
  it('does not connect when no session cookie exists', () => {
    clearCookies();
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.status).toBe('disconnected');
  });
});

// ---------------------------------------------------------------------------
// D5 reliability polish: backoff jitter + online-event recovery
// (manual retry() was dropped in the Pass-1 fix-pack — see the comment
// block below where the retry test used to live).
// ---------------------------------------------------------------------------

describe('useEventStream reconnect backoff — jitter (D5)', () => {
  it('applies ±20% jitter to the reconnect delay so concurrent clients do not thundering-herd the server', () => {
    jest.useFakeTimers();
    // Pin Math.random to a known value so we can compute the expected delay
    // deterministically. jitter formula: delay * (0.8 + random * 0.4), so
    // random=0 → 0.8x, random=1 → 1.2x, random=0.5 → 1.0x (no shift).
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // → 0.8x factor
    try {
      renderHook(() => useEventStream({ url: 'http://localhost:8080/events', maxRetries: 3 }));
      act(() => {
        MockEventSource.instances[0].simulateError();
      });
      // First retry: base 1000ms × 0.8 = 800ms. Advancing 799ms should NOT
      // have opened a new EventSource; 800ms should.
      const beforeCount = MockEventSource.instances.length;
      act(() => {
        jest.advanceTimersByTime(799);
      });
      expect(MockEventSource.instances.length).toBe(beforeCount);
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(MockEventSource.instances.length).toBe(beforeCount + 1);
    } finally {
      randomSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe('useEventStream online-event recovery (D5)', () => {
  it('reconnects when navigator.onLine transitions to true after exhausting retries', () => {
    jest.useFakeTimers();
    // Pin Math.random so jitter is deterministic (0.5 → factor 1.0).
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const { result } = renderHook(() =>
        useEventStream({ url: 'http://localhost:8080/events', maxRetries: 1 }),
      );

      // Burn through max retries to land in disconnected state
      act(() => {
        MockEventSource.instances[0].simulateError();
      });
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      act(() => {
        MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();
      });
      expect(result.current.status).toBe('disconnected');

      const instanceCountBeforeOnline = MockEventSource.instances.length;

      // Browser fires `online` — hook should respond by opening a fresh EventSource
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(MockEventSource.instances.length).toBe(instanceCountBeforeOnline + 1);
      // Status transitions back out of 'disconnected'
      expect(result.current.status).not.toBe('disconnected');
    } finally {
      randomSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('does not reconnect on online event when already connected (avoids unnecessary churn)', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });
    expect(result.current.status).toBe('connected');

    const instanceCountBeforeOnline = MockEventSource.instances.length;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    // No new EventSource opened because we're already connected
    expect(MockEventSource.instances.length).toBe(instanceCountBeforeOnline);
  });
});

// Manual retry() API was removed in the Pass-1 evaluator fix-pack.
// Dual-eval found the retry function was exported with a user-facing
// rationale but no consumer destructured it — `useLiveEvents`'s native
// dataLayer fallback already handles degradation without a retry
// affordance, so the retry() was dead API surface. If a future consumer
// needs direct SSE-only reconnect control (bypassing the fallback), add
// retry() back with a co-landed consumer.

// ---------------------------------------------------------------------------
// D2 graceful degradation: buffer survives connection drops + Pub/Sub backlog
// catch-up dedupes redeliveries and respects buffer cap.
//
// Path A (WebSocket drop → Timeline last-known-good): the events buffer is
// React state independent of connection status, so a connect → message →
// error → retry cycle preserves what's been received. The Timeline tab
// renders purely off `events.length` (`event-timeline.tsx:156`), so as long
// as the buffer is non-empty the visitor never sees a spinner gate even
// when status is 'reconnecting' or 'disconnected'.
//
// Path C (Pub/Sub latency → catches up without losing events): a backlog
// burst of mixed unique + redelivered events resolves to exactly the
// buffer-cap count of unique events because dedupe drops redeliveries on
// arrival before the cap is even tested.
// ---------------------------------------------------------------------------

describe('useEventStream graceful degradation (D2)', () => {
  it('preserves the events buffer through an error → reconnect cycle', () => {
    jest.useFakeTimers();
    // Pin Math.random so jitter is deterministic (factor 1.0).
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const { result } = renderHook(() =>
        useEventStream({ url: 'http://localhost:8080/events', maxRetries: 3 }),
      );

      // Connection 1 opens, one event lands.
      act(() => {
        MockEventSource.instances[0].simulateOpen();
      });
      const firstEvent = makePipelineEvent({
        event_name: 'page_view',
        timestamp: '2026-04-25T10:00:00.000Z',
        page_path: '/',
      });
      act(() => {
        MockEventSource.instances[0].simulateMessage(JSON.stringify(firstEvent));
      });
      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0].event_name).toBe('page_view');

      // Connection 1 errors. Status flips to 'reconnecting'; buffer stays.
      act(() => {
        MockEventSource.instances[0].simulateError();
      });
      expect(result.current.status).toBe('reconnecting');
      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0].event_name).toBe('page_view');

      // Backoff fires; a new EventSource is created.
      const beforeReconnect = MockEventSource.instances.length;
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(MockEventSource.instances.length).toBe(beforeReconnect + 1);
      // Buffer is still preserved across the gap.
      expect(result.current.events).toHaveLength(1);

      // Connection 2 opens. Status flips to 'connected'; buffer still preserved.
      act(() => {
        MockEventSource.instances[MockEventSource.instances.length - 1].simulateOpen();
      });
      expect(result.current.status).toBe('connected');
      expect(result.current.events).toHaveLength(1);

      // A new event delivered post-reconnect prepends to the preserved
      // buffer (does not start a fresh buffer).
      const secondEvent = makePipelineEvent({
        event_name: 'click_cta',
        timestamp: '2026-04-25T10:00:01.000Z',
        page_path: '/',
      });
      act(() => {
        MockEventSource.instances[MockEventSource.instances.length - 1].simulateMessage(
          JSON.stringify(secondEvent),
        );
      });
      expect(result.current.events).toHaveLength(2);
      expect(result.current.events[0].event_name).toBe('click_cta');
      expect(result.current.events[1].event_name).toBe('page_view');
    } finally {
      randomSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('preserves the events buffer through max-retries → disconnected', () => {
    jest.useFakeTimers();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const { result } = renderHook(() =>
        useEventStream({ url: 'http://localhost:8080/events', maxRetries: 1 }),
      );

      act(() => {
        MockEventSource.instances[0].simulateOpen();
      });
      const event = makePipelineEvent({
        event_name: 'page_view',
        timestamp: '2026-04-25T10:00:00.000Z',
        page_path: '/',
      });
      act(() => {
        MockEventSource.instances[0].simulateMessage(JSON.stringify(event));
      });
      expect(result.current.events).toHaveLength(1);

      // Burn through max retries → disconnected.
      act(() => {
        MockEventSource.instances[0].simulateError();
      });
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      act(() => {
        MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();
      });
      expect(result.current.status).toBe('disconnected');
      // Buffer survives all the way to the disconnected terminal state —
      // this is what makes "last-known-good" work in the Timeline tab.
      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0].event_name).toBe('page_view');
    } finally {
      randomSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('absorbs a Pub/Sub backlog burst with redeliveries: dedupes on arrival, caps at maxBufferSize', () => {
    // Simulate Pub/Sub latency catch-up: a backlog flushes as a burst of
    // mixed unique + redelivered events. Dedupe drops the redeliveries;
    // the buffer cap evicts oldest events newest-first.
    const { result } = renderHook(
      () => useEventStream({ url: 'http://localhost:8080/events' }), // default maxBufferSize=100
    );

    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });

    // Burst phase 1: 60 unique events.
    act(() => {
      for (let i = 0; i < 60; i++) {
        const event = makePipelineEvent({
          event_name: `event_${i}`,
          timestamp: `2026-04-25T10:00:${String(i).padStart(2, '0')}.000Z`,
          page_path: '/',
        });
        MockEventSource.instances[0].simulateMessage(JSON.stringify(event));
      }
    });
    expect(result.current.events).toHaveLength(60);

    // Burst phase 2: 10 redeliveries of events 50-59 (Pub/Sub at-least-once
    // semantics — same event_name + timestamp + page_path triple). All 10
    // should be deduped on arrival.
    act(() => {
      for (let i = 50; i < 60; i++) {
        const event = makePipelineEvent({
          event_name: `event_${i}`,
          timestamp: `2026-04-25T10:00:${String(i).padStart(2, '0')}.000Z`,
          page_path: '/',
        });
        MockEventSource.instances[0].simulateMessage(JSON.stringify(event));
      }
    });
    // Buffer length unchanged: redeliveries dropped at dedupe.
    expect(result.current.events).toHaveLength(60);

    // Burst phase 3: 50 more unique events. Now total unique = 110, which
    // exceeds the default cap of 100.
    act(() => {
      for (let i = 60; i < 110; i++) {
        const event = makePipelineEvent({
          event_name: `event_${i}`,
          timestamp: `2026-04-25T10:00:${String(i).padStart(2, '0')}.000Z`,
          page_path: '/',
        });
        MockEventSource.instances[0].simulateMessage(JSON.stringify(event));
      }
    });

    // Cap held at 100; oldest 10 events evicted (event_0 through event_9).
    expect(result.current.events).toHaveLength(100);
    // Newest event is at index 0 (most-recent-first ordering).
    expect(result.current.events[0].event_name).toBe('event_109');
    // Oldest survivor is event_10 (events 0-9 evicted).
    expect(result.current.events[result.current.events.length - 1].event_name).toBe('event_10');
    // None of the evicted-or-deduped events appear in the buffer.
    const names = new Set(result.current.events.map((e) => e.event_name));
    expect(names.has('event_0')).toBe(false);
    expect(names.has('event_9')).toBe(false);
    // Each event_50-59 appears exactly once (no inflation from redelivery).
    for (let i = 50; i < 60; i++) {
      const matches = result.current.events.filter((e) => e.event_name === `event_${i}`);
      expect(matches).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Routine reconnect vs failing stream (15.7)
//
// The proof panel tells a visitor when the live stream is not working. It must
// say so for a stream that is failing, and never for the routine reconnect:
// Cloud Run ends every stream after an hour, and the hook reopens it about a
// second later. A note on every visitor's screen once an hour would be a false
// alarm, and a stream that silently loops or never opens would be passed off
// as live.
// ---------------------------------------------------------------------------

describe('useEventStream routine reconnect vs failing stream (15.7)', () => {
  const URL = 'http://localhost:8080/events';
  const HOUR = 60 * 60 * 1000;
  let randomSpy: jest.SpyInstance;

  const latest = () => MockEventSource.instances[MockEventSource.instances.length - 1];

  /** Renders the hook and records every status it reports, in order. */
  function renderRecording() {
    const seen: string[] = [];
    const hook = renderHook(() => {
      const r = useEventStream({ url: URL });
      seen.push(r.status);
      return r;
    });
    return { ...hook, seen };
  }

  /** Every connection opens, then the far end ends it half a second later. */
  function openThenDropEveryConnection(): void {
    MockEventSource.script = (es) => {
      setTimeout(() => {
        if (!es.closed) es.simulateOpen();
      }, 100);
      setTimeout(() => {
        if (!es.closed) es.simulateError();
      }, 600);
    };
  }

  /** Advances in small steps until the hook makes its next connection attempt. */
  function waitForNextAttempt(): void {
    const before = MockEventSource.instances.length;
    for (let i = 0; i < 600 && MockEventSource.instances.length === before; i++) {
      act(() => jest.advanceTimersByTime(100));
    }
    expect(MockEventSource.instances.length).toBe(before + 1);
  }

  /** The newest connection opens and the far end ends it at once; the hook retries. */
  function openAndDrop(): void {
    act(() => latest().simulateOpen());
    act(() => latest().simulateError());
    waitForNextAttempt();
  }

  /** Drives a loop until the hook calls it failing. */
  function loopUntilFailing(result: { current: { status: string } }): void {
    for (let i = 0; i < STREAM_LOOP_DROPS; i++) openAndDrop();
    expect(result.current.status).toBe('failing');
  }

  beforeEach(() => {
    jest.useFakeTimers();
    // Jitter factor 1.0, so the backoff is exactly 1s, 2s, 4s...
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('a routine reconnect is never failing', () => {
    // More hours than the retry limit: each reconnect must start the backoff
    // and the retry count afresh, or the stream would give up after a few hours.
    it('reconnects after one second every hour, never failing and never giving up', () => {
      const { result, seen } = renderRecording();
      act(() => latest().simulateOpen());

      for (let hour = 0; hour < 7; hour++) {
        act(() => jest.advanceTimersByTime(HOUR));
        // Cloud Run ends the stream.
        act(() => latest().simulateError());
        expect(result.current.status).toBe('reconnecting');
        const before = MockEventSource.instances.length;
        act(() => jest.advanceTimersByTime(999));
        expect(MockEventSource.instances.length).toBe(before);
        act(() => jest.advanceTimersByTime(1));
        expect(MockEventSource.instances.length).toBe(before + 1);
        act(() => latest().simulateOpen());
        expect(result.current.status).toBe('connected');
      }

      act(() => jest.advanceTimersByTime(STREAM_FAILING_AFTER_MS * 2));
      expect(seen).not.toContain('failing');
      // The first entry is the hook's initial state, before it connects.
      expect(seen.slice(1)).not.toContain('disconnected');
    });

    // A cold start can refuse the first retry. The stream is back within
    // seconds, well inside the stated time, so it was never failing.
    it('is not failing when the first retry fails and the next one opens', () => {
      const { result, seen } = renderRecording();
      act(() => latest().simulateOpen());
      act(() => jest.advanceTimersByTime(HOUR));
      act(() => latest().simulateError());
      act(() => jest.advanceTimersByTime(1000));
      act(() => latest().simulateError());
      act(() => jest.advanceTimersByTime(2000));
      act(() => latest().simulateOpen());

      expect(result.current.status).toBe('connected');
      expect(seen).not.toContain('failing');
    });
  });

  describe('a connection that never opens is failing within the stated time', () => {
    // Fifteen seconds is the stated time in docs/ARCHITECTURE.md, so it is a literal here.
    it('when the attempt hangs without opening or erroring, at fifteen seconds', () => {
      const { result } = renderRecording();
      act(() => jest.advanceTimersByTime(14_999));
      expect(result.current.status).toBe('connecting');
      act(() => jest.advanceTimersByTime(1));
      expect(result.current.status).toBe('failing');
    });

    // A hung attempt is a dead socket. Waiting on it would leave the stream
    // failing for good, with nothing that could bring it back.
    it('abandons the hung attempt and retries it after the backoff', () => {
      const { result } = renderRecording();
      const hung = latest();
      act(() => jest.advanceTimersByTime(STREAM_FAILING_AFTER_MS));
      expect(hung.closed).toBe(true);

      act(() => jest.advanceTimersByTime(1000));
      expect(MockEventSource.instances).toHaveLength(2);
      expect(latest().closed).toBe(false);
      expect(result.current.status).toBe('failing');

      act(() => latest().simulateOpen());
      expect(result.current.status).toBe('connected');
    });

    it('when every attempt errors, and it stays failing while it keeps retrying', () => {
      MockEventSource.script = (es) => {
        setTimeout(() => {
          if (!es.closed) es.simulateError();
        }, 100);
      };
      const { result, seen } = renderRecording();
      act(() => jest.advanceTimersByTime(STREAM_FAILING_AFTER_MS - 1));
      expect(result.current.status).toBe('reconnecting');
      expect(seen).not.toContain('failing');

      act(() => jest.advanceTimersByTime(1));
      expect(result.current.status).toBe('failing');

      // The retries continue (the default gives up after five), and the note
      // must not flicker off at each new attempt.
      const failedAt = seen.length;
      const attemptsBefore = MockEventSource.instances.length;
      act(() => jest.advanceTimersByTime(10_000));
      expect(MockEventSource.instances.length).toBeGreaterThan(attemptsBefore);
      expect(seen.slice(failedAt)).toEqual(
        expect.not.arrayContaining(['connecting', 'reconnecting', 'connected']),
      );
    });

    // `error` is the hook's second account of the same state; it must not say
    // all is well while `status` says failing.
    it('keeps an error set while failing, through the next attempt', () => {
      const { result } = renderRecording();
      act(() => jest.advanceTimersByTime(STREAM_FAILING_AFTER_MS));
      expect(result.current.status).toBe('failing');
      expect(result.current.error).toBeTruthy();

      act(() => jest.advanceTimersByTime(1000));
      expect(MockEventSource.instances).toHaveLength(2);
      expect(result.current.status).toBe('failing');
      expect(result.current.error).toBeTruthy();

      act(() => latest().simulateOpen());
      expect(result.current.error).toBeNull();
    });

    it('is connected as soon as the stream finally opens', () => {
      const { result } = renderRecording();
      act(() => jest.advanceTimersByTime(STREAM_FAILING_AFTER_MS - 1));
      act(() => latest().simulateOpen());
      act(() => jest.advanceTimersByTime(1));
      expect(result.current.status).toBe('connected');
    });

    // An offline spell is a common cause; coming back online should try again
    // at once rather than wait out the backoff.
    it('reconnects at once when the browser comes back online', () => {
      const { result } = renderRecording();
      act(() => jest.advanceTimersByTime(STREAM_FAILING_AFTER_MS));
      expect(result.current.status).toBe('failing');
      const before = MockEventSource.instances.length;
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(MockEventSource.instances.length).toBe(before + 1);
    });
  });

  describe('a stream that keeps opening and dropping is failing', () => {
    it('is failing by the drop that makes a loop, well within the loop window, and not before', () => {
      openThenDropEveryConnection();
      const start = jest.now();
      const { result } = renderRecording();
      let drops = 0;
      const countDrops = () => MockEventSource.instances.filter((es) => es.closed).length;
      const withinWindow = () => jest.now() - start < STREAM_LOOP_WINDOW_MS;

      // Each loop is about 1.6s: open, drop after half a second, retry after 1s.
      while (drops < STREAM_LOOP_DROPS - 1 && withinWindow()) {
        act(() => jest.advanceTimersByTime(100));
        drops = countDrops();
        expect(result.current.status).not.toBe('failing');
      }
      while (drops < STREAM_LOOP_DROPS && withinWindow()) {
        act(() => jest.advanceTimersByTime(100));
        drops = countDrops();
      }
      expect(drops).toBe(STREAM_LOOP_DROPS);
      expect(withinWindow()).toBe(true);
      expect(result.current.status).toBe('failing');
    });

    // Each reopen in the loop must not clear the note, or it would flash on
    // and off every second and be re-announced each time.
    it('stays failing through each short reopen while the loop continues', () => {
      openThenDropEveryConnection();
      const { result, seen } = renderRecording();
      act(() => jest.advanceTimersByTime(10_000));
      expect(result.current.status).toBe('failing');
      const failedAt = seen.indexOf('failing');
      expect(seen.slice(failedAt)).toEqual(
        expect.not.arrayContaining(['connecting', 'reconnecting', 'connected']),
      );
    });

    // A connection that stays open is delivering. Holding `failing` on it
    // would put "These are the last events it delivered" over rows that are
    // still updating.
    // Ten seconds is the figure docs/ARCHITECTURE.md states, so it is a literal here.
    it('is connected once a reopen stays open for ten seconds, and not at 9.9', () => {
      const { result } = renderRecording();
      loopUntilFailing(result);

      act(() => latest().simulateOpen());
      expect(result.current.status).toBe('failing');
      act(() => jest.advanceTimersByTime(9_900));
      expect(result.current.status).toBe('failing');
      act(() => jest.advanceTimersByTime(100));
      expect(result.current.status).toBe('connected');
    });

    // After the stream has settled, the old loop's drops must not count
    // against the next ordinary drop.
    it('forgets the loop once settled: the next drop is a routine reconnect', () => {
      const { result } = renderRecording();
      loopUntilFailing(result);
      act(() => latest().simulateOpen());
      act(() => jest.advanceTimersByTime(STREAM_SETTLE_MS));
      expect(result.current.status).toBe('connected');

      act(() => latest().simulateError());
      expect(result.current.status).toBe('reconnecting');
      const before = MockEventSource.instances.length;
      act(() => jest.advanceTimersByTime(1000));
      expect(MockEventSource.instances.length).toBe(before + 1);
    });

    // A loop that reconnects every second forever costs the server and, with
    // two tabs, takes the stream from the other tab each time. Each open in a
    // loop must not reset the backoff, so the gaps grow and it gives up.
    it('backs off with growing gaps and gives up on a loop that does not stop', () => {
      const attemptTimes: number[] = [];
      MockEventSource.script = (es) => {
        attemptTimes.push(jest.now());
        setTimeout(() => {
          if (!es.closed) es.simulateOpen();
        }, 100);
        setTimeout(() => {
          if (!es.closed) es.simulateError();
        }, 600);
      };
      const { result } = renderRecording();
      act(() => jest.advanceTimersByTime(5 * 60 * 1000));

      expect(result.current.status).toBe('disconnected');
      const gaps = attemptTimes.slice(1).map((t, i) => t - attemptTimes[i]);
      // Once the loop is detected, each gap is longer than the one before.
      const afterDetection = gaps.slice(STREAM_LOOP_DROPS - 1);
      expect(afterDetection.length).toBeGreaterThan(2);
      afterDetection.slice(1).forEach((gap, i) => {
        expect(gap).toBeGreaterThan(afterDetection[i]);
      });
    });

    // `online` fires spuriously on network hand-offs. Restarting an open
    // connection would drop a working stream and wipe the loop's history.
    it('does not tear down an open connection on an online event, and keeps the loop state', () => {
      const { result } = renderRecording();
      loopUntilFailing(result);
      act(() => latest().simulateOpen());
      const open = latest();
      const before = MockEventSource.instances.length;

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(open.closed).toBe(false);
      expect(MockEventSource.instances.length).toBe(before);
      expect(result.current.status).toBe('failing');
      act(() => jest.advanceTimersByTime(STREAM_SETTLE_MS));
      expect(result.current.status).toBe('connected');
    });
  });

  // This test pushes the event into every mock itself, so it says nothing
  // about the server. It claims only that two hook instances on one session
  // are independent: each holds its own connection and buffer, and neither
  // goes `failing`. The evidence that the server keeps both tabs' connections
  // and delivers to each is the two-tab tests in
  // infrastructure/cloud-run/event-stream/src/server.test.ts.
  describe('two hook instances on one session', () => {
    it('stay independent: each connected with its own buffer, never failing', () => {
      MockEventSource.script = (es) => {
        setTimeout(() => {
          if (!es.closed) es.simulateOpen();
        }, 100);
      };
      const tabA = renderRecording();
      const tabB = renderRecording();
      act(() => jest.advanceTimersByTime(1000));
      expect(MockEventSource.instances).toHaveLength(2);

      // The server sends the session's event to every open connection.
      const event = makePipelineEvent({ event_name: 'click_cta' });
      act(() => {
        MockEventSource.instances
          .filter((es) => !es.closed)
          .forEach((es) => es.simulateMessage(JSON.stringify(event)));
      });

      act(() => jest.advanceTimersByTime(STREAM_LOOP_WINDOW_MS));
      for (const tab of [tabA, tabB]) {
        expect(tab.result.current.status).toBe('connected');
        expect(tab.result.current.events.map((e) => e.event_name)).toEqual(['click_cta']);
        expect(tab.seen).not.toContain('failing');
      }
      expect(MockEventSource.instances.every((es) => !es.closed)).toBe(true);
    });
  });
});

describe('isStreamDown', () => {
  // The panel's note shows exactly for these; a first connection or a routine
  // reconnect is not a failure worth announcing.
  it.each(['off', 'failing', 'disconnected'] as const)('is true for %s', (status) => {
    expect(isStreamDown(status)).toBe(true);
  });

  it.each(['connecting', 'connected', 'reconnecting'] as const)('is false for %s', (status) => {
    expect(isStreamDown(status)).toBe(false);
  });
});
