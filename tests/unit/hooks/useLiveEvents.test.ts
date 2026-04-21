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
});
