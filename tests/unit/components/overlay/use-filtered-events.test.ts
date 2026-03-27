/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';
import { createPipelineEvent } from '@/lib/events/pipeline-schema';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

import { usePathname } from 'next/navigation';

const mockUsePathname = usePathname as jest.Mock;

function makeEvent(overrides: Partial<PipelineEvent> = {}): PipelineEvent {
  return createPipelineEvent({
    session_id: 'test-session',
    event_name: 'page_view',
    timestamp: '2026-03-27T10:00:00Z',
    page_path: '/',
    page_title: 'Home',
    page_location: 'https://iampatterson.com/',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functionality_storage: 'granted',
    },
    routing: [{ destination: 'ga4', status: 'sent', timestamp: '2026-03-27T10:00:01Z' }],
    ...overrides,
  });
}

describe('useFilteredEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all events when filterByRoute is false', () => {
    mockUsePathname.mockReturnValue('/services');
    const events = [
      makeEvent({ page_path: '/' }),
      makeEvent({ page_path: '/services' }),
      makeEvent({ page_path: '/about' }),
    ];
    const { result } = renderHook(() => useFilteredEvents(events, false));
    expect(result.current.filteredEvents).toHaveLength(3);
  });

  it('filters events to the current route when filterByRoute is true', () => {
    mockUsePathname.mockReturnValue('/services');
    const events = [
      makeEvent({ page_path: '/' }),
      makeEvent({ page_path: '/services' }),
      makeEvent({ page_path: '/about' }),
    ];
    const { result } = renderHook(() => useFilteredEvents(events, true));
    expect(result.current.filteredEvents).toHaveLength(1);
    expect(result.current.filteredEvents[0].page_path).toBe('/services');
  });

  it('returns the current pathname', () => {
    mockUsePathname.mockReturnValue('/about');
    const { result } = renderHook(() => useFilteredEvents([], false));
    expect(result.current.currentPath).toBe('/about');
  });

  it('handles demo route namespaces — includes child routes', () => {
    mockUsePathname.mockReturnValue('/demo/ecommerce');
    const events = [
      makeEvent({ page_path: '/demo/ecommerce' }),
      makeEvent({ page_path: '/demo/ecommerce/product/1' }),
      makeEvent({ page_path: '/demo/subscription' }),
      makeEvent({ page_path: '/services' }),
    ];
    const { result } = renderHook(() => useFilteredEvents(events, true));
    expect(result.current.filteredEvents).toHaveLength(2);
  });

  it('defaults filterByRoute to false', () => {
    mockUsePathname.mockReturnValue('/services');
    const events = [makeEvent({ page_path: '/' }), makeEvent({ page_path: '/services' })];
    const { result } = renderHook(() => useFilteredEvents(events));
    expect(result.current.filteredEvents).toHaveLength(2);
  });
});
