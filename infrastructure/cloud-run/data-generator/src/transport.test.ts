import { buildMpPayload, sendEvents } from './transport';
import type { SyntheticBaseEvent } from './types';
import type { TransportConfig } from './transport';

describe('transport', () => {
  describe('buildMpPayload', () => {
    const baseEvent: SyntheticBaseEvent = {
      iap_source: true,
      event: 'page_view',
      timestamp: '2025-06-15T14:00:00Z',
      session_id: 'sess-123',
      iap_session_id: 'sess-123',
      page_path: '/demo/ecommerce',
      page_title: 'The Tuna Shop',
      consent_analytics: true,
      consent_marketing: false,
      consent_preferences: true,
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'google_brand_tuna_merch',
    };

    it('creates a valid Measurement Protocol payload', () => {
      const payload = buildMpPayload(baseEvent, 'G-TEST123');

      expect(payload.client_id).toBe('sess-123');
      expect(payload.events).toHaveLength(1);

      const event = (payload.events as Array<Record<string, unknown>>)[0];
      expect(event.name).toBe('page_view');
      expect(event.params).toBeDefined();
    });

    it('includes all base event parameters', () => {
      const payload = buildMpPayload(baseEvent, 'G-TEST123');
      const params = (
        (payload.events as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).params as Record<string, unknown>;

      expect(params.iap_source).toBe(true);
      expect(params.session_id).toBe('sess-123');
      expect(params.iap_session_id).toBe('sess-123');
      expect(params.page_path).toBe('/demo/ecommerce');
      expect(params.page_title).toBe('The Tuna Shop');
      expect(params.consent_analytics).toBe(true);
      expect(params.consent_marketing).toBe(false);
    });

    it('includes UTM parameters when present', () => {
      const payload = buildMpPayload(baseEvent, 'G-TEST123');
      const params = (
        (payload.events as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).params as Record<string, unknown>;

      expect(params.utm_source).toBe('google');
      expect(params.utm_medium).toBe('cpc');
      expect(params.utm_campaign).toBe('google_brand_tuna_merch');
    });

    it('omits UTM parameters when not present', () => {
      const eventNoUtm: SyntheticBaseEvent = {
        ...baseEvent,
        utm_source: undefined,
        utm_medium: undefined,
        utm_campaign: undefined,
      };
      const payload = buildMpPayload(eventNoUtm, 'G-TEST123');
      const params = (
        (payload.events as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).params as Record<string, unknown>;

      expect(params.utm_source).toBeUndefined();
      expect(params.utm_medium).toBeUndefined();
      expect(params.utm_campaign).toBeUndefined();
    });

    it('constructs page_location from page_path', () => {
      const payload = buildMpPayload(baseEvent, 'G-TEST123');
      const params = (
        (payload.events as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).params as Record<string, unknown>;

      expect(params.page_location).toBe('https://iampatterson-com.vercel.app/demo/ecommerce');
    });

    it('includes custom event parameters beyond base fields', () => {
      const productViewEvent = {
        ...baseEvent,
        event: 'product_view',
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        product_category: 'toys',
      };

      const payload = buildMpPayload(productViewEvent, 'G-TEST123');
      const params = (
        (payload.events as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).params as Record<string, unknown>;

      expect(params.product_id).toBe('tuna-plush');
      expect(params.product_name).toBe('Tuna Plush Toy');
      expect(params.product_price).toBe(24.99);
    });

    it('includes engagement_time_msec', () => {
      const payload = buildMpPayload(baseEvent, 'G-TEST123');
      const params = (
        (payload.events as Array<Record<string, unknown>>)[0] as Record<string, unknown>
      ).params as Record<string, unknown>;
      expect(params.engagement_time_msec).toBe(100);
    });
  });

  describe('sendEvents', () => {
    it('reports all events as failed when fetch fails', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const config: TransportConfig = {
        mpUrl: 'https://test.example.com',
        measurementId: 'G-TEST',
        apiSecret: 'secret',
        batchSize: 10,
        batchDelayMs: 0,
      };

      const events: SyntheticBaseEvent[] = [
        {
          iap_source: true,
          event: 'test',
          timestamp: '2025-01-01T00:00:00Z',
          session_id: 'sess-1',
          iap_session_id: 'sess-1',
          page_path: '/test',
          page_title: 'Test',
          consent_analytics: true,
          consent_marketing: true,
          consent_preferences: true,
        },
      ];

      const result = await sendEvents(events, config);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);

      global.fetch = originalFetch;
    });

    it('reports events as sent on success', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
      });

      const config: TransportConfig = {
        mpUrl: 'https://test.example.com',
        measurementId: 'G-TEST',
        apiSecret: 'secret',
        batchSize: 25,
        batchDelayMs: 0,
      };

      const events: SyntheticBaseEvent[] = Array.from({ length: 3 }, (_, i) => ({
        iap_source: true as const,
        event: 'test',
        timestamp: '2025-01-01T00:00:00Z',
        session_id: `sess-${i}`,
        iap_session_id: `sess-${i}`,
        page_path: '/test',
        page_title: 'Test',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
      }));

      const result = await sendEvents(events, config);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);

      global.fetch = originalFetch;
    });
  });
});
