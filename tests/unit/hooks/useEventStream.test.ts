/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useEventStream } from '@/hooks/useEventStream';
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

  constructor(url: string) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    MockEventSource.instances.push(this);
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
// D5 — Reliability polish: backoff jitter, online-event recovery, manual retry
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
