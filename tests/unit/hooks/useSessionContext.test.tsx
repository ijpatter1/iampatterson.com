/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { useSessionContext } from '@/hooks/useSessionContext';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

const mockLiveEvents = jest.fn<{ events: PipelineEvent[]; source: 'sse' | 'dataLayer' }, []>();

jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => mockLiveEvents(),
}));

function makeEvent(partial: Partial<PipelineEvent>): PipelineEvent {
  return {
    pipeline_id: partial.pipeline_id ?? 'pl-1',
    received_at: partial.received_at ?? new Date().toISOString(),
    session_id: partial.session_id ?? 'ses_abc',
    event_name: partial.event_name ?? 'page_view',
    timestamp: partial.timestamp ?? new Date().toISOString(),
    page_path: partial.page_path ?? '/',
    page_title: partial.page_title ?? '',
    page_location: partial.page_location ?? '',
    parameters: partial.parameters ?? {},
    consent: partial.consent ?? {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'denied',
    },
    routing: partial.routing ?? [],
  };
}

beforeEach(() => {
  mockLiveEvents.mockReset();
  // Clear all cookies between tests.
  document.cookie.split(';').forEach((c) => {
    document.cookie = `${c.split('=')[0].trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
});

describe('useSessionContext', () => {
  it('returns empty context when no events have flowed and no cookie is set', () => {
    mockLiveEvents.mockReturnValue({ events: [], source: 'dataLayer' });
    const { result } = renderHook(() => useSessionContext());
    expect(result.current.session_id).toBe('');
    expect(result.current.last_event_name).toBe('');
    expect(result.current.events_in_session).toBe(0);
    expect(result.current.add_to_cart_in_last_30s).toBe(0);
  });

  it('reads session_id from the _iap_sid cookie after mount', () => {
    document.cookie = '_iap_sid=ses_live_123; path=/';
    mockLiveEvents.mockReturnValue({ events: [], source: 'dataLayer' });
    const { result } = renderHook(() => useSessionContext());
    expect(result.current.session_id).toBe('ses_live_123');
  });

  it('surfaces the latest event name + timestamp when events have flowed', () => {
    const now = new Date('2026-04-21T18:30:00Z').toISOString();
    mockLiveEvents.mockReturnValue({
      events: [
        makeEvent({ event_name: 'add_to_cart', received_at: now }),
        makeEvent({ event_name: 'product_view' }),
      ],
      source: 'dataLayer',
    });
    const { result } = renderHook(() => useSessionContext());
    expect(result.current.last_event_name).toBe('add_to_cart');
    expect(result.current.last_event_at).toBe(now);
    expect(result.current.events_in_session).toBe(2);
  });

  it('counts add_to_cart events in the last 30s for volume_anomaly feeding', () => {
    const now = Date.now();
    mockLiveEvents.mockReturnValue({
      events: [
        makeEvent({ event_name: 'add_to_cart', received_at: new Date(now - 5000).toISOString() }),
        makeEvent({ event_name: 'add_to_cart', received_at: new Date(now - 15_000).toISOString() }),
        // Outside 30s window — should not count.
        makeEvent({ event_name: 'add_to_cart', received_at: new Date(now - 45_000).toISOString() }),
        // Different event name — should not count toward add_to_cart.
        makeEvent({ event_name: 'product_view', received_at: new Date(now).toISOString() }),
      ],
      source: 'dataLayer',
    });
    const { result } = renderHook(() => useSessionContext());
    expect(result.current.add_to_cart_in_last_30s).toBe(2);
  });

  it('seconds_since_last_event does not freeze while idle — re-ticks on interval', () => {
    jest.useFakeTimers();
    try {
      const tenSecAgo = new Date(Date.now() - 10_000).toISOString();
      mockLiveEvents.mockReturnValue({
        events: [makeEvent({ event_name: 'product_view', received_at: tenSecAgo })],
        source: 'dataLayer',
      });
      const { result } = renderHook(() => useSessionContext());
      expect(result.current.seconds_since_last_event).toBe(10);

      // Advance real time by 8s; without the tick, the value would
      // stay at 10. With the tick, it re-computes to ~18.
      jest.setSystemTime(Date.now() + 8_000);
      act(() => {
        jest.advanceTimersByTime(5_000);
      });
      expect(result.current.seconds_since_last_event).toBeGreaterThanOrEqual(18);
    } finally {
      jest.useRealTimers();
    }
  });

  it('derives consent flags from the latest event', () => {
    mockLiveEvents.mockReturnValue({
      events: [
        makeEvent({
          event_name: 'purchase',
          consent: {
            analytics_storage: 'granted',
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted',
            functionality_storage: 'granted',
          },
        }),
      ],
      source: 'dataLayer',
    });
    const { result } = renderHook(() => useSessionContext());
    expect(result.current.consent_analytics).toBe(true);
    expect(result.current.consent_marketing).toBe(true);
  });
});
