/**
 * @jest-environment jsdom
 */
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { useEventStream } from '@/hooks/useEventStream';
import { _resetKnownSessionIdForTests } from '@/lib/events/session';

// Hydration renders with the server's snapshot, which has no cookie, and the
// cookie store reports the real value a render later. A visitor whose cookie
// is set must never see the stream pass through `disconnected` (which shows
// and announces the panel's note) on the way to connecting.

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  close(): void {
    this.closed = true;
  }
}

Object.defineProperty(globalThis, 'EventSource', { value: MockEventSource, writable: true });

const statuses: string[] = [];

function Probe() {
  const { status } = useEventStream({ url: 'http://localhost:8080/events' });
  statuses.push(status);
  return <span>{status}</span>;
}

beforeEach(() => {
  MockEventSource.instances = [];
  statuses.length = 0;
  _resetKnownSessionIdForTests();
  document.cookie = '_iap_sid=sess-hydrated; Path=/';
});

afterEach(() => {
  document.cookie = '_iap_sid=; Max-Age=0; Path=/';
});

it('never reports disconnected while hydrating with a cookie, and opens under its ID', async () => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Probe />);
  document.body.appendChild(container);
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    root = hydrateRoot(container, <Probe />);
  });

  expect(statuses.length).toBeGreaterThan(1);
  expect(statuses).not.toContain('disconnected');
  expect(MockEventSource.instances).toHaveLength(1);
  expect(MockEventSource.instances[0].url).toBe(
    'http://localhost:8080/events?session_id=sess-hydrated',
  );

  act(() => root?.unmount());
  container.remove();
});
