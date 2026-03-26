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

  it('transitions to disconnected on error', () => {
    const { result } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });
    act(() => {
      MockEventSource.instances[0].simulateError();
    });
    expect(result.current.status).toBe('disconnected');
    expect(result.current.error).toBeTruthy();
  });

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useEventStream({ url: 'http://localhost:8080/events' }));
    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
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
