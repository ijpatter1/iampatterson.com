/**
 * @jest-environment jsdom
 */
import { pushEvent } from '@/lib/events/push';
import type { PageViewEvent } from '@/lib/events/schema';

describe('pushEvent', () => {
  beforeEach(() => {
    // Reset dataLayer before each test
    window.dataLayer = [];
  });

  it('initializes window.dataLayer if it does not exist', () => {
    delete (window as Record<string, unknown>).dataLayer;
    const event: PageViewEvent = {
      event: 'page_view',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'test-session',
      page_path: '/',
      page_title: 'Home',
      page_referrer: '',
    };
    pushEvent(event);
    expect(window.dataLayer).toBeDefined();
    expect(window.dataLayer).toHaveLength(1);
  });

  it('pushes an event object onto window.dataLayer', () => {
    const event: PageViewEvent = {
      event: 'page_view',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'test-session',
      page_path: '/',
      page_title: 'Home',
      page_referrer: '/about',
    };
    pushEvent(event);
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toEqual(event);
  });

  it('appends to existing dataLayer entries', () => {
    window.dataLayer = [{ event: 'existing_event' }];
    const event: PageViewEvent = {
      event: 'page_view',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'test-session',
      page_path: '/',
      page_title: 'Home',
      page_referrer: '',
    };
    pushEvent(event);
    expect(window.dataLayer).toHaveLength(2);
    expect(window.dataLayer[1]).toEqual(event);
  });

  it('preserves all event properties including extra fields', () => {
    const event = {
      event: 'page_view',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'test-session',
      page_path: '/',
      page_title: 'Home',
      page_referrer: '',
      custom_field: 'custom_value',
    } satisfies PageViewEvent & Record<string, unknown>;
    pushEvent(event);
    expect(window.dataLayer[0]).toHaveProperty('custom_field', 'custom_value');
  });
});
