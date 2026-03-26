import type {
  ConsentState,
  RoutingDestination,
  RoutingResult,
  PipelineEvent,
} from '@/lib/events/pipeline-schema';
import {
  ROUTING_DESTINATIONS,
  isPipelineEvent,
  createPipelineEvent,
} from '@/lib/events/pipeline-schema';

/** Minimal valid pipeline event for testing. */
function validEvent(overrides: Partial<PipelineEvent> = {}): PipelineEvent {
  return {
    pipeline_id: 'pipe-abc-123',
    received_at: '2026-03-26T12:00:00.000Z',
    session_id: 'sess-def-456',
    event_name: 'page_view',
    timestamp: '2026-03-26T11:59:59.500Z',
    page_path: '/',
    page_title: 'Home — Patterson Consulting',
    page_location: 'https://iampatterson-com.vercel.app/',
    parameters: { page_referrer: '/about' },
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing: [
      { destination: 'ga4', status: 'sent', timestamp: '2026-03-26T12:00:00.100Z' },
      { destination: 'bigquery', status: 'sent', timestamp: '2026-03-26T12:00:00.120Z' },
      {
        destination: 'meta_capi',
        status: 'blocked_consent',
        timestamp: '2026-03-26T12:00:00.130Z',
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Type-level compile checks (these verify the TS types exist and are correct)
// ---------------------------------------------------------------------------

describe('Pipeline event types', () => {
  it('defines ConsentState with all Consent Mode v2 signals', () => {
    const consent: ConsentState = {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    };
    expect(consent.analytics_storage).toBe('granted');
    expect(consent.ad_storage).toBe('denied');
  });

  it('defines RoutingResult with destination, status, and timestamp', () => {
    const result: RoutingResult = {
      destination: 'ga4',
      status: 'sent',
      timestamp: '2026-03-26T12:00:00.000Z',
    };
    expect(result.destination).toBe('ga4');
    expect(result.status).toBe('sent');
    expect(result.timestamp).toBeTruthy();
  });

  it('defines PipelineEvent with all required fields', () => {
    const event = validEvent();
    expect(event.pipeline_id).toBeTruthy();
    expect(event.received_at).toBeTruthy();
    expect(event.session_id).toBeTruthy();
    expect(event.event_name).toBe('page_view');
    expect(event.timestamp).toBeTruthy();
    expect(event.page_path).toBe('/');
    expect(event.page_title).toBeTruthy();
    expect(event.page_location).toBeTruthy();
    expect(event.parameters).toBeDefined();
    expect(event.consent).toBeDefined();
    expect(event.routing).toHaveLength(3);
  });

  it('allows empty parameters object', () => {
    const event = validEvent({ parameters: {} });
    expect(event.parameters).toEqual({});
  });

  it('allows empty routing array', () => {
    const event = validEvent({ routing: [] });
    expect(event.routing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ROUTING_DESTINATIONS constant
// ---------------------------------------------------------------------------

describe('ROUTING_DESTINATIONS', () => {
  it('includes all known routing destinations', () => {
    expect(ROUTING_DESTINATIONS).toContain('ga4');
    expect(ROUTING_DESTINATIONS).toContain('bigquery');
    expect(ROUTING_DESTINATIONS).toContain('meta_capi');
    expect(ROUTING_DESTINATIONS).toContain('google_ads');
    expect(ROUTING_DESTINATIONS).toContain('pubsub');
  });

  it('is a frozen array', () => {
    expect(Object.isFrozen(ROUTING_DESTINATIONS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isPipelineEvent type guard
// ---------------------------------------------------------------------------

describe('isPipelineEvent', () => {
  it('returns true for a valid pipeline event', () => {
    expect(isPipelineEvent(validEvent())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPipelineEvent(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPipelineEvent(undefined)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isPipelineEvent('not an event')).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isPipelineEvent({})).toBe(false);
  });

  it('returns false when pipeline_id is missing', () => {
    const { pipeline_id, ...rest } = validEvent();
    expect(isPipelineEvent(rest)).toBe(false);
  });

  it('returns false when event_name is missing', () => {
    const { event_name, ...rest } = validEvent();
    expect(isPipelineEvent(rest)).toBe(false);
  });

  it('returns false when session_id is missing', () => {
    const { session_id, ...rest } = validEvent();
    expect(isPipelineEvent(rest)).toBe(false);
  });

  it('returns false when consent is missing', () => {
    const { consent, ...rest } = validEvent();
    expect(isPipelineEvent(rest)).toBe(false);
  });

  it('returns false when routing is not an array', () => {
    expect(isPipelineEvent(validEvent({ routing: 'not-array' as never }))).toBe(false);
  });

  it('returns false when consent is missing a required field', () => {
    const event = validEvent();
    const badConsent = { ...event.consent } as Record<string, unknown>;
    delete badConsent.analytics_storage;
    expect(isPipelineEvent({ ...event, consent: badConsent })).toBe(false);
  });

  it('returns false when consent has invalid value', () => {
    const event = validEvent();
    const badConsent = { ...event.consent, analytics_storage: 'maybe' };
    expect(isPipelineEvent({ ...event, consent: badConsent })).toBe(false);
  });

  it('validates against parsed JSON (round-trip)', () => {
    const event = validEvent();
    const json = JSON.stringify(event);
    const parsed: unknown = JSON.parse(json);
    expect(isPipelineEvent(parsed)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createPipelineEvent factory
// ---------------------------------------------------------------------------

describe('createPipelineEvent', () => {
  it('creates a valid pipeline event with required fields', () => {
    const event = createPipelineEvent({
      session_id: 'sess-abc',
      event_name: 'click_cta',
      timestamp: '2026-03-26T12:00:00.000Z',
      page_path: '/services',
      page_title: 'Services',
      page_location: 'https://iampatterson-com.vercel.app/services',
      parameters: { cta_text: 'Get started', cta_location: 'hero' },
      consent: {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'denied',
        functionality_storage: 'granted',
      },
      routing: [{ destination: 'ga4', status: 'sent', timestamp: '2026-03-26T12:00:00.100Z' }],
    });

    expect(isPipelineEvent(event)).toBe(true);
    expect(event.pipeline_id).toBeTruthy();
    expect(event.received_at).toBeTruthy();
    expect(event.event_name).toBe('click_cta');
    expect(event.session_id).toBe('sess-abc');
  });

  it('auto-generates pipeline_id as a non-empty string', () => {
    const a = createPipelineEvent({
      session_id: 's1',
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
    });
    const b = createPipelineEvent({
      session_id: 's1',
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
    });

    expect(a.pipeline_id).toBeTruthy();
    expect(b.pipeline_id).toBeTruthy();
    expect(a.pipeline_id).not.toBe(b.pipeline_id);
  });

  it('auto-generates received_at as a valid ISO timestamp', () => {
    const event = createPipelineEvent({
      session_id: 's1',
      event_name: 'page_view',
      timestamp: '2026-03-26T12:00:00.000Z',
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
    });

    expect(new Date(event.received_at).toISOString()).toBe(event.received_at);
  });

  it('allows overriding pipeline_id and received_at', () => {
    const event = createPipelineEvent({
      pipeline_id: 'custom-id',
      received_at: '2026-01-01T00:00:00.000Z',
      session_id: 's1',
      event_name: 'page_view',
      timestamp: '2026-03-26T12:00:00.000Z',
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
    });

    expect(event.pipeline_id).toBe('custom-id');
    expect(event.received_at).toBe('2026-01-01T00:00:00.000Z');
  });
});
