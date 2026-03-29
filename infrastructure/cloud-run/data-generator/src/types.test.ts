import type {
  BusinessModel,
  SyntheticBaseEvent,
  ProductViewEvent,
  AddToCartEvent,
  PurchaseEvent,
  TrialSignupEvent,
  FormCompleteEvent,
  LeadQualifyEvent,
  AdPlatformRecord,
  GeneratorConfig,
  EcommerceProfile,
  SubscriptionProfile,
  LeadGenProfile,
} from './types';

/**
 * Type-level tests — these verify our type definitions compile correctly
 * and the type guards work at runtime. If TypeScript compiles these,
 * the types are structurally sound.
 */

describe('types', () => {
  describe('BusinessModel', () => {
    it('accepts valid business model values', () => {
      const models: BusinessModel[] = ['ecommerce', 'subscription', 'leadgen'];
      expect(models).toHaveLength(3);
    });
  });

  describe('SyntheticBaseEvent', () => {
    it('has the required shape matching the site data layer', () => {
      const event: SyntheticBaseEvent = {
        iap_source: true,
        event: 'page_view',
        timestamp: '2025-01-15T10:30:00Z',
        session_id: 'abc-123',
        client_id: 'client-abc-123',
        iap_session_id: 'abc-123',
        page_path: '/demo/ecommerce',
        page_title: 'Tuna Shop',
        consent_analytics: true,
        consent_marketing: false,
        consent_preferences: true,
      };

      expect(event.iap_source).toBe(true);
      expect(event.event).toBe('page_view');
      expect(event.session_id).toBe(event.iap_session_id);
    });

    it('supports optional UTM parameters', () => {
      const event: SyntheticBaseEvent = {
        iap_source: true,
        event: 'page_view',
        timestamp: '2025-01-15T10:30:00Z',
        session_id: 'abc-123',
        client_id: 'client-abc-123',
        iap_session_id: 'abc-123',
        page_path: '/demo/ecommerce',
        page_title: 'Tuna Shop',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'google_brand_tuna_merch',
      };

      expect(event.utm_source).toBe('google');
      expect(event.utm_medium).toBe('cpc');
      expect(event.utm_campaign).toBe('google_brand_tuna_merch');
    });
  });

  describe('E-commerce event types', () => {
    it('ProductViewEvent includes product details', () => {
      const event: ProductViewEvent = {
        iap_source: true,
        event: 'product_view',
        timestamp: '2025-01-15T10:30:00Z',
        session_id: 'abc-123',
        client_id: 'client-abc-123',
        iap_session_id: 'abc-123',
        page_path: '/demo/ecommerce/product/tuna-plush',
        page_title: 'Tuna Plush Toy',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        product_category: 'toys',
      };
      expect(event.product_price).toBe(24.99);
    });

    it('PurchaseEvent includes order details with product array', () => {
      const event: PurchaseEvent = {
        iap_source: true,
        event: 'purchase',
        timestamp: '2025-01-15T10:30:00Z',
        session_id: 'abc-123',
        client_id: 'client-abc-123',
        iap_session_id: 'abc-123',
        page_path: '/demo/ecommerce/checkout/confirm',
        page_title: 'Order Confirmation',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
        order_id: 'ORD-001',
        order_total: 44.98,
        item_count: 2,
        products: [
          { product_id: 'tuna-plush', product_name: 'Tuna Plush Toy', price: 24.99, quantity: 1 },
          { product_id: 'tuna-calendar', product_name: 'Tuna 2026 Calendar', price: 19.99, quantity: 1 },
        ],
      };
      expect(event.products).toHaveLength(2);
      expect(event.order_total).toBe(44.98);
    });
  });

  describe('Subscription event types', () => {
    it('TrialSignupEvent includes plan details', () => {
      const event: TrialSignupEvent = {
        iap_source: true,
        event: 'trial_signup',
        timestamp: '2025-01-15T10:30:00Z',
        session_id: 'abc-123',
        client_id: 'client-abc-123',
        iap_session_id: 'abc-123',
        page_path: '/demo/subscription/signup',
        page_title: 'Start Your Trial',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
        plan_id: 'good-boy',
        plan_name: 'The Good Boy',
        plan_price: 34.99,
      };
      expect(event.plan_id).toBe('good-boy');
    });
  });

  describe('Lead gen event types', () => {
    it('FormCompleteEvent includes form fields', () => {
      const event: FormCompleteEvent = {
        iap_source: true,
        event: 'form_complete',
        timestamp: '2025-01-15T10:30:00Z',
        session_id: 'abc-123',
        client_id: 'client-abc-123',
        iap_session_id: 'abc-123',
        page_path: '/demo/leadgen',
        page_title: 'Tuna Brand Partnerships',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
        form_name: 'partnership_inquiry',
        partnership_type: 'product_collaboration',
        budget_range: '15k_50k',
        company_name: 'Acme Pet Co',
      };
      expect(event.partnership_type).toBe('product_collaboration');
    });

    it('LeadQualifyEvent includes qualification tier', () => {
      const event: LeadQualifyEvent = {
        iap_source: true,
        event: 'lead_qualify',
        timestamp: '2025-01-15T10:30:00Z',
        session_id: 'abc-123',
        client_id: 'client-abc-123',
        iap_session_id: 'abc-123',
        page_path: '/demo/leadgen',
        page_title: 'Tuna Brand Partnerships',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
        lead_id: 'LEAD-001',
        qualification_tier: 'high',
        partnership_type: 'licensing',
        budget_range: '50k_plus',
      };
      expect(event.qualification_tier).toBe('high');
    });
  });

  describe('AdPlatformRecord', () => {
    it('has campaign name and raw variant', () => {
      const record: AdPlatformRecord = {
        date: '2025-01-15',
        platform: 'meta',
        business_model: 'ecommerce',
        campaign_name: 'Meta - Retargeting - Cart Abandoners',
        campaign_name_raw: 'FB Retargeting - Cart Abandoners',
        impressions: 15000,
        clicks: 375,
        spend: 225.0,
        cpc: 0.6,
        ctr: 0.025,
      };
      expect(record.campaign_name).not.toBe(record.campaign_name_raw);
    });
  });
});
