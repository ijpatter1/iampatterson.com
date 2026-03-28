import { buildCollectParams, sendEvents } from './transport';
import type { SyntheticBaseEvent } from './types';
import type { TransportConfig } from './transport';

describe('transport', () => {
  describe('buildCollectParams', () => {
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

    it('creates params with GA4 protocol version 2', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('v')).toBe('2');
    });

    it('sets measurement ID as tid', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('tid')).toBe('G-TEST123');
    });

    it('sets client ID from session_id', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('cid')).toBe('sess-123');
    });

    it('sets event name as en', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('en')).toBe('page_view');
    });

    it('sets document location from page_path', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('dl')).toBe('https://iampatterson-com.vercel.app/demo/ecommerce');
    });

    it('sets document title', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('dt')).toBe('The Tuna Shop');
    });

    it('includes iap_source as string event parameter', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('ep.iap_source')).toBe('true');
    });

    it('includes session IDs as event parameters', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('ep.session_id')).toBe('sess-123');
      expect(params.get('ep.iap_session_id')).toBe('sess-123');
    });

    it('includes consent state as event parameters', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('ep.consent_analytics')).toBe('true');
      expect(params.get('ep.consent_marketing')).toBe('false');
      expect(params.get('ep.consent_preferences')).toBe('true');
    });

    it('includes UTM parameters when present', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('ep.utm_source')).toBe('google');
      expect(params.get('ep.utm_medium')).toBe('cpc');
      expect(params.get('ep.utm_campaign')).toBe('google_brand_tuna_merch');
    });

    it('omits UTM parameters when not present', () => {
      const eventNoUtm: SyntheticBaseEvent = {
        ...baseEvent,
        utm_source: undefined,
        utm_medium: undefined,
        utm_campaign: undefined,
      };
      const params = buildCollectParams(eventNoUtm, 'G-TEST123');
      expect(params.has('ep.utm_source')).toBe(false);
      expect(params.has('ep.utm_medium')).toBe(false);
      expect(params.has('ep.utm_campaign')).toBe(false);
    });

    it('encodes numeric custom params with epn. prefix', () => {
      const productViewEvent = {
        ...baseEvent,
        event: 'product_view',
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        product_category: 'toys',
      };

      const params = buildCollectParams(productViewEvent, 'G-TEST123');
      expect(params.get('ep.product_id')).toBe('tuna-plush');
      expect(params.get('ep.product_name')).toBe('Tuna Plush Toy');
      expect(params.get('epn.product_price')).toBe('24.99');
      expect(params.get('ep.product_category')).toBe('toys');
    });

    it('includes engagement time', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      expect(params.get('_et')).toBe('100');
    });

    it('produces a valid URL-encoded string', () => {
      const params = buildCollectParams(baseEvent, 'G-TEST123');
      const str = params.toString();
      expect(str).toContain('v=2');
      expect(str).toContain('tid=G-TEST123');
      expect(str).toContain('en=page_view');
      // Should be URL-encoded, not JSON
      expect(str).not.toContain('{');
      expect(str).not.toContain('}');
    });
  });

  describe('sendEvents', () => {
    it('reports all events as failed when fetch fails', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const config: TransportConfig = {
        sgtmUrl: 'https://test.example.com',
        measurementId: 'G-TEST',
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
        sgtmUrl: 'https://test.example.com',
        measurementId: 'G-TEST',
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

      // Verify it sent to /g/collect with form-encoded body
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toBe('https://test.example.com/g/collect');
      expect(calls[0][1].headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      global.fetch = originalFetch;
    });
  });
});
