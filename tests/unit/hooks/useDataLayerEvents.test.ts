/**
 * Tests for useDataLayerEvents — converts window.dataLayer pushes
 * into PipelineEvent objects for the timeline.
 */
import { renderHook, act } from '@testing-library/react';

import { useDataLayerEvents } from '@/hooks/useDataLayerEvents';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

// Minimal dataLayer entry matching BaseEvent shape from track.ts
function makeDataLayerEntry(overrides: Record<string, unknown> = {}) {
  return {
    iap_source: true,
    event: 'page_view',
    timestamp: '2026-04-04T12:00:00.000Z',
    session_id: 'test-session-123',
    iap_session_id: 'test-session-123',
    page_path: '/services',
    page_title: 'Services',
    consent_analytics: true,
    consent_marketing: false,
    consent_preferences: true,
    ...overrides,
  };
}

describe('useDataLayerEvents', () => {
  beforeEach(() => {
    window.dataLayer = [];
    // F8 added a timeline-buffer sessionStorage persistence. Clear the
    // key between tests so previous-test fixtures don't bleed into
    // useState(() => loadTimelineBuffer()) on the next mount.
    window.sessionStorage.clear();
  });

  afterEach(() => {
    delete (window as Record<string, unknown>).dataLayer;
    jest.useRealTimers();
  });

  it('returns empty events initially', () => {
    const { result } = renderHook(() => useDataLayerEvents());
    expect(result.current.events).toEqual([]);
  });

  it('eager-loads the persisted timeline buffer on mount (F8 refresh fix)', () => {
    // Seed the sessionStorage ring buffer as if a prior page-load had
    // captured these events. On mount the hook should return them
    // immediately — not wait for the first poll tick.
    window.sessionStorage.setItem(
      'iampatterson.timeline_buffer',
      JSON.stringify([
        {
          pipeline_id: 'prev-1',
          received_at: '2026-04-21T00:00:01.000Z',
          session_id: 'sid-xyz',
          event_name: 'page_view',
          timestamp: '2026-04-21T00:00:00.000Z',
          page_path: '/',
          page_title: '',
          page_location: 'http://localhost/',
          parameters: {},
          consent: {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            functionality_storage: 'granted',
          },
          routing: [],
        },
      ]),
    );
    const { result } = renderHook(() => useDataLayerEvents());
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].pipeline_id).toBe('prev-1');
  });

  it('converts a dataLayer push into a PipelineEvent', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDataLayerEvents());

    act(() => {
      window.dataLayer.push(makeDataLayerEntry());
      jest.advanceTimersByTime(500);
    });

    expect(result.current.events).toHaveLength(1);
    const event: PipelineEvent = result.current.events[0];
    expect(event.event_name).toBe('page_view');
    expect(event.page_path).toBe('/services');
    expect(event.session_id).toBe('test-session-123');
    expect(event.pipeline_id).toMatch(/^dl-/);
    expect(event.consent.analytics_storage).toBe('granted');
    expect(event.consent.ad_storage).toBe('denied');
    expect(event.routing).toHaveLength(5);
  });

  it('ignores non-iap_source entries (e.g. gtm.js auto-events)', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDataLayerEvents());

    act(() => {
      window.dataLayer.push({ event: 'gtm.js', 'gtm.start': Date.now() });
      window.dataLayer.push(makeDataLayerEntry({ event: 'click_cta' }));
      jest.advanceTimersByTime(500);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].event_name).toBe('click_cta');
  });

  it('orders events most-recent first', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDataLayerEvents());

    act(() => {
      window.dataLayer.push(
        makeDataLayerEntry({ event: 'page_view', timestamp: '2026-04-04T12:00:00.000Z' }),
      );
      window.dataLayer.push(
        makeDataLayerEntry({ event: 'click_cta', timestamp: '2026-04-04T12:01:00.000Z' }),
      );
      jest.advanceTimersByTime(500);
    });

    expect(result.current.events[0].event_name).toBe('click_cta');
    expect(result.current.events[1].event_name).toBe('page_view');
  });

  it('respects maxBufferSize', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDataLayerEvents({ maxBufferSize: 2 }));

    act(() => {
      window.dataLayer.push(makeDataLayerEntry({ event: 'page_view' }));
      window.dataLayer.push(makeDataLayerEntry({ event: 'click_nav' }));
      window.dataLayer.push(makeDataLayerEntry({ event: 'click_cta' }));
      jest.advanceTimersByTime(500);
    });

    expect(result.current.events).toHaveLength(2);
    // Most recent two kept
    expect(result.current.events[0].event_name).toBe('click_cta');
    expect(result.current.events[1].event_name).toBe('click_nav');
  });

  it('builds correct consent state from boolean flags', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDataLayerEvents());

    act(() => {
      window.dataLayer.push(
        makeDataLayerEntry({
          consent_analytics: true,
          consent_marketing: true,
          consent_preferences: false,
        }),
      );
      jest.advanceTimersByTime(500);
    });

    const consent = result.current.events[0].consent;
    expect(consent.analytics_storage).toBe('granted');
    expect(consent.ad_storage).toBe('granted');
    expect(consent.ad_user_data).toBe('granted');
    expect(consent.ad_personalization).toBe('granted');
    expect(consent.functionality_storage).toBe('denied');
  });

  it('generates simulated routing based on consent state', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDataLayerEvents());

    // Marketing denied — Meta CAPI and Google Ads should be blocked
    act(() => {
      window.dataLayer.push(makeDataLayerEntry({ consent_marketing: false }));
      jest.advanceTimersByTime(500);
    });

    const routing = result.current.events[0].routing;
    const metaRoute = routing.find((r) => r.destination === 'meta_capi');
    const adsRoute = routing.find((r) => r.destination === 'google_ads');
    const ga4Route = routing.find((r) => r.destination === 'ga4');
    const bqRoute = routing.find((r) => r.destination === 'bigquery');

    expect(metaRoute?.status).toBe('blocked_consent');
    expect(adsRoute?.status).toBe('blocked_consent');
    expect(ga4Route?.status).toBe('sent');
    expect(bqRoute?.status).toBe('sent');
  });

  it('clearEvents empties the buffer', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDataLayerEvents());

    act(() => {
      window.dataLayer.push(makeDataLayerEntry());
      jest.advanceTimersByTime(500);
    });
    expect(result.current.events).toHaveLength(1);

    act(() => {
      result.current.clearEvents();
    });
    expect(result.current.events).toEqual([]);
  });

  it('picks up events that existed in dataLayer before mount', () => {
    jest.useFakeTimers();
    // Pre-populate dataLayer before hook mounts
    window.dataLayer = [makeDataLayerEntry({ event: 'page_view' })];

    const { result } = renderHook(() => useDataLayerEvents());

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].event_name).toBe('page_view');
  });
});
