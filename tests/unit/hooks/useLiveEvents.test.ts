/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

let mockSseEvents: PipelineEvent[] = [];
let mockDlEvents: PipelineEvent[] = [];

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    status: 'disconnected',
    events: mockSseEvents,
    error: null,
    clearEvents: jest.fn(),
  }),
}));

jest.mock('@/hooks/useDataLayerEvents', () => ({
  useDataLayerEvents: () => ({
    events: mockDlEvents,
    clearEvents: jest.fn(),
  }),
}));

import { useLiveEvents } from '@/hooks/useLiveEvents';

function makeEvent(id: string, name: string): PipelineEvent {
  return {
    pipeline_id: id,
    received_at: new Date().toISOString(),
    session_id: 'test',
    event_name: name,
    timestamp: new Date().toISOString(),
    page_path: '/',
    page_title: '',
    page_location: '',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing: [],
  };
}

describe('useLiveEvents', () => {
  beforeEach(() => {
    mockSseEvents = [];
    mockDlEvents = [];
    delete process.env.NEXT_PUBLIC_EVENT_STREAM_URL;
  });

  it('falls back to dataLayer events when SSE URL is unset', () => {
    mockDlEvents = [makeEvent('dl-1', 'page_view')];
    const { result } = renderHook(() => useLiveEvents());
    expect(result.current.source).toBe('dataLayer');
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].pipeline_id).toBe('dl-1');
  });

  it('falls back to dataLayer when SSE URL is set but no SSE events yet', () => {
    process.env.NEXT_PUBLIC_EVENT_STREAM_URL = 'https://events.example.com';
    mockSseEvents = [];
    mockDlEvents = [makeEvent('dl-1', 'page_view')];
    const { result } = renderHook(() => useLiveEvents());
    expect(result.current.source).toBe('dataLayer');
    expect(result.current.events[0].pipeline_id).toBe('dl-1');
  });

  it('prefers SSE events when the pipeline has delivered at least one', () => {
    process.env.NEXT_PUBLIC_EVENT_STREAM_URL = 'https://events.example.com';
    mockSseEvents = [makeEvent('sse-1', 'page_view')];
    mockDlEvents = [makeEvent('dl-1', 'scroll_depth')];
    const { result } = renderHook(() => useLiveEvents());
    expect(result.current.source).toBe('sse');
    expect(result.current.events[0].pipeline_id).toBe('sse-1');
  });

  it('sticks to SSE once it has ever delivered, even if the buffer later empties', () => {
    process.env.NEXT_PUBLIC_EVENT_STREAM_URL = 'https://events.example.com';
    mockSseEvents = [makeEvent('sse-1', 'page_view')];
    mockDlEvents = [makeEvent('dl-1', 'scroll_depth')];
    const { result, rerender } = renderHook(() => useLiveEvents());
    expect(result.current.source).toBe('sse');
    expect(result.current.events[0].pipeline_id).toBe('sse-1');

    // Simulate SSE buffer draining while dataLayer still has events
    mockSseEvents = [];
    rerender();

    // Source stays on 'sse', the sticky flag prevents a visible flip.
    // `events` returns the empty SSE buffer, NOT the dataLayer fallback
    // (a silent swap would be worse UX than a momentarily-empty feed).
    expect(result.current.source).toBe('sse');
    expect(result.current.events).toHaveLength(0);
  });

  /**
   * Ian, 2026-09-09, looking at the live site: "I'm looking at an empty
   * timeline (barring the consent event) while the counter shows 9 events."
   *
   * [14.1]'s consent gate exempts exactly one tag — `GA4 - consent_update`
   * carries "No consent requirement — consent_update must fire regardless of
   * consent state". For a declining visitor that single event is the ONLY one
   * that reaches the server, and it comes back over SSE. The sticky latch below
   * flips on it, and every data-layer event carrying `blocked_consent` is
   * discarded for the rest of the session.
   *
   * It only reproduces where NEXT_PUBLIC_EVENT_STREAM_URL is set — production.
   * Local dev has no SSE, `sseEnabled` is false, the timeline falls back to the
   * data layer and looks correct. That is why no test caught it.
   */
  it('shows a declining visitor their own events, not just the one exempt tag', () => {
    process.env.NEXT_PUBLIC_EVENT_STREAM_URL = 'https://events.example.com';
    // What actually reaches the server when analytics is denied: one event.
    mockSseEvents = [makeEvent('sse-consent', 'consent_update')];
    // What the visitor actually did, all of it blocked at the gate.
    mockDlEvents = [
      makeEvent('dl-1', 'page_view'),
      makeEvent('dl-2', 'scroll_depth'),
      makeEvent('dl-3', 'web_vital'),
      makeEvent('dl-4', 'click_cta'),
    ];

    const { result } = renderHook(() => useLiveEvents({ analyticsConsent: 'denied' }));

    expect(result.current.source).toBe('dataLayer');
    expect(result.current.events.length).toBeGreaterThan(1);
    expect(result.current.events.map((e) => e.event_name)).toEqual(
      expect.arrayContaining(['page_view', 'scroll_depth', 'web_vital', 'click_cta']),
    );
  });

  it('still prefers SSE for a consenting visitor, so the latch is unchanged there', () => {
    process.env.NEXT_PUBLIC_EVENT_STREAM_URL = 'https://events.example.com';
    mockSseEvents = [makeEvent('sse-1', 'page_view')];
    mockDlEvents = [makeEvent('dl-1', 'scroll_depth')];

    const { result } = renderHook(() => useLiveEvents({ analyticsConsent: 'granted' }));

    expect(result.current.source).toBe('sse');
    expect(result.current.events[0].pipeline_id).toBe('sse-1');
  });

  /**
   * The production sequence, which the other tests skip by mounting with
   * consent already known. In the browser `analyticsConsent` is undefined until
   * the CookieConsent cookie is found, so the hook mounts undefined, the latch
   * flips on the exempt event, and consent resolves to 'denied' AFTERWARDS.
   *
   * A review pointed out that a refactor resolving the source once — memoizing
   * `useSse`, or hoisting it into state on first resolution — would keep every
   * other test here green while restoring the exact reported bug. This is the
   * one that would fail.
   */
  it('pins to the data layer when consent resolves to denied AFTER the latch flipped', () => {
    process.env.NEXT_PUBLIC_EVENT_STREAM_URL = 'https://events.example.com';
    mockSseEvents = [makeEvent('sse-consent', 'consent_update')];
    mockDlEvents = [makeEvent('dl-1', 'page_view'), makeEvent('dl-2', 'scroll_depth')];

    // Mount with consent unknown — the latch flips on the exempt event.
    const { result, rerender } = renderHook(
      ({ consent }: { consent?: 'granted' | 'denied' }) =>
        useLiveEvents({ analyticsConsent: consent }),
      { initialProps: { consent: undefined as 'granted' | 'denied' | undefined } },
    );
    expect(result.current.source).toBe('sse');

    // The cookie is found; consent resolves to denied. The pin must beat the
    // already-set sticky flag.
    rerender({ consent: 'denied' });
    expect(result.current.source).toBe('dataLayer');
    expect(result.current.events.map((e) => e.event_name)).toEqual(
      expect.arrayContaining(['page_view', 'scroll_depth']),
    );
  });

  it('prefers SSE when consent is not yet known, since guessing would be its own dishonesty', () => {
    process.env.NEXT_PUBLIC_EVENT_STREAM_URL = 'https://events.example.com';
    mockSseEvents = [makeEvent('sse-1', 'page_view')];
    mockDlEvents = [makeEvent('dl-1', 'scroll_depth')];

    const { result } = renderHook(() => useLiveEvents());

    expect(result.current.source).toBe('sse');
  });
});
