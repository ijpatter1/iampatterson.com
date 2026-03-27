import { generateEcommerceSession } from './ecommerce';
import { createSessionContext } from '../session';
import { createEcommerceConfig } from '../profiles';
import { SeededRandom } from '../random';
import type {
  EcommerceProfile,
  ProductViewEvent,
  AddToCartEvent,
  BeginCheckoutEvent,
  PurchaseEvent,
  SyntheticBaseEvent,
} from '../types';

function makeSession(seed = 42) {
  const config = createEcommerceConfig({ seed });
  const rng = new SeededRandom(seed);
  const timestamp = new Date('2025-06-15T14:00:00Z');
  const ctx = createSessionContext(config, timestamp, rng);
  return { config, rng, ctx, profile: config.profile as EcommerceProfile };
}

describe('generateEcommerceSession', () => {
  it('always starts with a page_view event', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateEcommerceSession(ctx, profile, rng);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].event).toBe('page_view');
  });

  it('all events share the same session_id', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateEcommerceSession(ctx, profile, rng);
    for (const event of events) {
      expect((event as SyntheticBaseEvent).session_id).toBe(ctx.sessionId);
      expect((event as SyntheticBaseEvent).iap_session_id).toBe(ctx.sessionId);
    }
  });

  it('all events have iap_source: true', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateEcommerceSession(ctx, profile, rng);
    for (const event of events) {
      expect((event as SyntheticBaseEvent).iap_source).toBe(true);
    }
  });

  it('all events have valid ISO timestamps', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateEcommerceSession(ctx, profile, rng);
    for (const event of events) {
      const ts = new Date((event as SyntheticBaseEvent).timestamp);
      expect(ts.getTime()).not.toBeNaN();
    }
  });

  it('timestamps are monotonically increasing within a session', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateEcommerceSession(ctx, profile, rng);
    for (let i = 1; i < events.length; i++) {
      const prev = new Date((events[i - 1] as SyntheticBaseEvent).timestamp).getTime();
      const curr = new Date((events[i] as SyntheticBaseEvent).timestamp).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('includes product_view events with valid product details', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateEcommerceSession(ctx, profile, rng);
    const productViews = events.filter((e) => e.event === 'product_view') as ProductViewEvent[];
    expect(productViews.length).toBeGreaterThanOrEqual(1);
    for (const pv of productViews) {
      expect(pv.product_id).toBeTruthy();
      expect(pv.product_name).toBeTruthy();
      expect(pv.product_price).toBeGreaterThan(0);
      expect(pv.product_category).toBeTruthy();
      expect(pv.page_path).toContain('/demo/ecommerce/product/');
    }
  });

  it('product_view products come from the configured product list', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateEcommerceSession(ctx, profile, rng);
    const validIds = new Set(profile.products.map((p) => p.id));
    const productViews = events.filter((e) => e.event === 'product_view') as ProductViewEvent[];
    for (const pv of productViews) {
      expect(validIds.has(pv.product_id)).toBe(true);
    }
  });

  it('reproduces the same session for the same seed', () => {
    const run1 = makeSession(123);
    const events1 = generateEcommerceSession(run1.ctx, run1.profile, run1.rng);
    const run2 = makeSession(123);
    const events2 = generateEcommerceSession(run2.ctx, run2.profile, run2.rng);
    expect(events1.map((e) => e.event)).toEqual(events2.map((e) => e.event));
  });

  describe('funnel behavior over many sessions', () => {
    function runManySessions(n: number) {
      const config = createEcommerceConfig();
      const profile = config.profile as EcommerceProfile;
      const stats = {
        total: 0,
        withAddToCart: 0,
        withCheckout: 0,
        withPurchase: 0,
      };

      for (let i = 0; i < n; i++) {
        const rng = new SeededRandom(i);
        const ctx = createSessionContext(config, new Date('2025-06-15T14:00:00Z'), rng);
        const events = generateEcommerceSession(ctx, profile, rng);
        const eventNames = events.map((e) => e.event);

        stats.total++;
        if (eventNames.includes('add_to_cart')) stats.withAddToCart++;
        if (eventNames.includes('begin_checkout')) stats.withCheckout++;
        if (eventNames.includes('purchase')) stats.withPurchase++;
      }
      return stats;
    }

    it('funnel narrows at each step (add_to_cart > checkout > purchase)', () => {
      const stats = runManySessions(1000);
      expect(stats.withAddToCart).toBeGreaterThan(stats.withCheckout);
      expect(stats.withCheckout).toBeGreaterThan(stats.withPurchase);
    });

    it('add_to_cart rate is roughly consistent with configured viewToCart rate', () => {
      const stats = runManySessions(2000);
      const rate = stats.withAddToCart / stats.total;
      // Configured at 0.12 — allow wide tolerance for random variance
      expect(rate).toBeGreaterThan(0.06);
      expect(rate).toBeLessThan(0.2);
    });

    it('purchase rate is roughly consistent with full funnel conversion', () => {
      const stats = runManySessions(2000);
      const rate = stats.withPurchase / stats.total;
      // Expected: 0.12 * 0.55 * 0.75 ≈ 0.0495
      expect(rate).toBeGreaterThan(0.02);
      expect(rate).toBeLessThan(0.1);
    });
  });

  describe('add_to_cart events', () => {
    it('have valid quantity and product details', () => {
      // Run enough sessions to find ones with add_to_cart
      for (let seed = 0; seed < 100; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateEcommerceSession(ctx, profile, rng);
        const addToCartEvents = events.filter((e) => e.event === 'add_to_cart') as AddToCartEvent[];
        for (const atc of addToCartEvents) {
          expect(atc.quantity).toBeGreaterThanOrEqual(1);
          expect(atc.product_id).toBeTruthy();
          expect(atc.product_price).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('purchase events', () => {
    it('have valid order details with product array', () => {
      // Run enough sessions to find ones with purchase
      let foundPurchase = false;
      for (let seed = 0; seed < 200; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateEcommerceSession(ctx, profile, rng);
        const purchases = events.filter((e) => e.event === 'purchase') as PurchaseEvent[];
        for (const p of purchases) {
          foundPurchase = true;
          expect(p.order_id).toMatch(/^ORD-/);
          expect(p.order_total).toBeGreaterThan(0);
          expect(p.item_count).toBeGreaterThanOrEqual(1);
          expect(p.products.length).toBeGreaterThanOrEqual(1);
          // Order total should match sum of products
          const calculatedTotal = p.products.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );
          expect(p.order_total).toBeCloseTo(calculatedTotal, 2);
        }
      }
      expect(foundPurchase).toBe(true);
    });
  });

  describe('UTM parameters', () => {
    it('includes UTM params for paid channel sessions', () => {
      // Run sessions until we find one with a paid channel
      let foundPaid = false;
      for (let seed = 0; seed < 50; seed++) {
        const config = createEcommerceConfig({ seed });
        const rng = new SeededRandom(seed);
        const ctx = createSessionContext(config, new Date('2025-06-15T14:00:00Z'), rng);
        if (ctx.channel.platform === 'google' || ctx.channel.platform === 'meta') {
          const events = generateEcommerceSession(ctx, config.profile as EcommerceProfile, rng);
          const base = events[0] as SyntheticBaseEvent;
          expect(base.utm_source).toBeTruthy();
          expect(base.utm_medium).toBeTruthy();
          foundPaid = true;
          break;
        }
      }
      expect(foundPaid).toBe(true);
    });
  });

  describe('consent state', () => {
    it('all events in a session share the same consent state', () => {
      const { ctx, profile, rng } = makeSession();
      const events = generateEcommerceSession(ctx, profile, rng);
      for (const event of events) {
        const base = event as SyntheticBaseEvent;
        expect(base.consent_analytics).toBe(ctx.consentAnalytics);
        expect(base.consent_marketing).toBe(ctx.consentMarketing);
        expect(base.consent_preferences).toBe(ctx.consentPreferences);
      }
    });
  });
});
