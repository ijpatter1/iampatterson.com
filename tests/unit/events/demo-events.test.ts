/**
 * @jest-environment jsdom
 */
import {
  trackProductView,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  trackPlanSelect,
  trackTrialSignup,
  trackFormComplete,
  trackLeadQualify,
} from '@/lib/events/track';

// Mock crypto.randomUUID for session ID
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-session-id' },
});

beforeEach(() => {
  window.dataLayer = [];
  document.cookie = '_iap_sid=; Max-Age=0; Path=/';
});

describe('E-commerce demo events', () => {
  describe('trackProductView', () => {
    it('pushes a product_view event with product details', () => {
      trackProductView({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        product_category: 'toys',
      });
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer[0]).toMatchObject({
        event: 'product_view',
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        product_category: 'toys',
        iap_source: true,
      });
    });
  });

  describe('trackAddToCart', () => {
    it('pushes an add_to_cart event with product and quantity', () => {
      trackAddToCart({
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 2,
      });
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer[0]).toMatchObject({
        event: 'add_to_cart',
        product_id: 'tuna-plush',
        product_name: 'Tuna Plush Toy',
        product_price: 24.99,
        quantity: 2,
      });
    });
  });

  describe('trackBeginCheckout', () => {
    it('pushes a begin_checkout event with cart details', () => {
      trackBeginCheckout({ cart_total: 49.98, item_count: 2 });
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer[0]).toMatchObject({
        event: 'begin_checkout',
        cart_total: 49.98,
        item_count: 2,
      });
    });
  });

  describe('trackPurchase', () => {
    it('pushes a purchase event with order details and products', () => {
      const products = JSON.stringify([
        { product_id: 'tuna-plush', product_name: 'Tuna Plush Toy', price: 24.99, quantity: 2 },
      ]);
      trackPurchase({
        order_id: 'ORD-001',
        order_total: 49.98,
        item_count: 2,
        products,
      });
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer[0]).toMatchObject({
        event: 'purchase',
        order_id: 'ORD-001',
        order_total: 49.98,
        item_count: 2,
        products,
      });
    });
  });
});

describe('Subscription demo events', () => {
  describe('trackPlanSelect', () => {
    it('pushes a plan_select event with plan details', () => {
      trackPlanSelect({
        plan_id: 'good-boy',
        plan_name: 'The Good Boy',
        plan_price: 34.99,
      });
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer[0]).toMatchObject({
        event: 'plan_select',
        plan_id: 'good-boy',
        plan_name: 'The Good Boy',
        plan_price: 34.99,
      });
    });
  });

  describe('trackTrialSignup', () => {
    it('pushes a trial_signup event with plan details', () => {
      trackTrialSignup({
        plan_id: 'good-boy',
        plan_name: 'The Good Boy',
        plan_price: 34.99,
      });
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer[0]).toMatchObject({
        event: 'trial_signup',
        plan_id: 'good-boy',
        plan_name: 'The Good Boy',
        plan_price: 34.99,
      });
    });
  });
});

describe('Lead gen demo events', () => {
  describe('trackFormComplete', () => {
    it('pushes a form_complete event with form data', () => {
      trackFormComplete({
        form_name: 'partnership_inquiry',
        partnership_type: 'sponsored_content',
        budget_range: '15k_50k',
        company_name: 'Acme Corp',
      });
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer[0]).toMatchObject({
        event: 'form_complete',
        form_name: 'partnership_inquiry',
        partnership_type: 'sponsored_content',
        budget_range: '15k_50k',
        company_name: 'Acme Corp',
      });
    });
  });

  describe('trackLeadQualify', () => {
    it('pushes a lead_qualify event with qualification data', () => {
      trackLeadQualify({
        lead_id: 'LEAD-001',
        qualification_tier: 'hot',
        partnership_type: 'sponsored_content',
        budget_range: '15k_50k',
      });
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer[0]).toMatchObject({
        event: 'lead_qualify',
        lead_id: 'LEAD-001',
        qualification_tier: 'hot',
        partnership_type: 'sponsored_content',
        budget_range: '15k_50k',
      });
    });
  });
});

describe('All demo events include base fields', () => {
  it('product_view includes session_id and iap_source', () => {
    trackProductView({
      product_id: 'tuna-mug',
      product_name: 'Tuna Mug',
      product_price: 17.99,
      product_category: 'drinkware',
    });
    const pushed = window.dataLayer[0];
    expect(pushed).toHaveProperty('iap_source', true);
    expect(pushed).toHaveProperty('session_id', 'test-session-id');
    expect(pushed).toHaveProperty('iap_session_id', 'test-session-id');
    expect(pushed).toHaveProperty('timestamp');
    expect(pushed).toHaveProperty('page_path');
    expect(pushed).toHaveProperty('page_title');
    expect(pushed).toHaveProperty('consent_analytics');
    expect(pushed).toHaveProperty('consent_marketing');
    expect(pushed).toHaveProperty('consent_preferences');
  });

  it('trial_signup includes all base fields', () => {
    trackTrialSignup({
      plan_id: 'pup',
      plan_name: 'The Pup',
      plan_price: 19.99,
    });
    const pushed = window.dataLayer[0];
    expect(pushed).toHaveProperty('iap_source', true);
    expect(pushed).toHaveProperty('session_id');
    expect(pushed).toHaveProperty('timestamp');
  });

  it('lead_qualify includes all base fields', () => {
    trackLeadQualify({
      lead_id: 'LEAD-002',
      qualification_tier: 'warm',
      partnership_type: 'licensing',
      budget_range: '5k_15k',
    });
    const pushed = window.dataLayer[0];
    expect(pushed).toHaveProperty('iap_source', true);
    expect(pushed).toHaveProperty('session_id');
    expect(pushed).toHaveProperty('timestamp');
  });
});
