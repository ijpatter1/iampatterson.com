import { validateConfig } from './validation';
import { createEcommerceConfig, createSubscriptionConfig, createLeadgenConfig } from './profiles';
import type { GeneratorConfig, EcommerceProfile, SubscriptionProfile, LeadGenProfile } from './types';

describe('validateConfig', () => {
  describe('valid default configs', () => {
    it('validates the default ecommerce config', () => {
      const result = validateConfig(createEcommerceConfig());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates the default subscription config', () => {
      const result = validateConfig(createSubscriptionConfig());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates the default leadgen config', () => {
      const result = validateConfig(createLeadgenConfig());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('top-level validation', () => {
    it('rejects zero dailySessions', () => {
      const config = createEcommerceConfig({ dailySessions: 0 });
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'dailySessions')).toBe(true);
    });

    it('rejects negative backfillMonths', () => {
      const config = createEcommerceConfig({ backfillMonths: -1 });
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'backfillMonths')).toBe(true);
    });

    it('rejects extreme growth rates', () => {
      const config = createEcommerceConfig({ monthlyGrowthRate: 2.0 });
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'monthlyGrowthRate')).toBe(true);
    });
  });

  describe('profile/businessModel mismatch', () => {
    it('rejects when profile.model does not match businessModel', () => {
      const config = createEcommerceConfig();
      // Force mismatch
      (config as unknown as { businessModel: string }).businessModel = 'subscription';
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.model')).toBe(true);
    });
  });

  describe('channel validation', () => {
    it('rejects empty channels', () => {
      const config = createEcommerceConfig({ channels: [] });
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'channels')).toBe(true);
    });

    it('rejects channels with traffic shares not summing to ~1', () => {
      const config = createEcommerceConfig({
        channels: [
          { platform: 'google', trafficShare: 0.3, campaigns: [] },
          { platform: 'meta', trafficShare: 0.3, campaigns: [] },
          // Missing 0.4 — total is only 0.6
        ],
      });
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'channels.trafficShare')).toBe(true);
    });

    it('accepts channels with traffic shares summing to within tolerance', () => {
      const config = createEcommerceConfig({
        channels: [
          { platform: 'google', trafficShare: 0.48, campaigns: [] },
          { platform: 'meta', trafficShare: 0.49, campaigns: [] },
          // Sum = 0.97, within 0.05 tolerance
        ],
      });
      const result = validateConfig(config);
      // Should not have a trafficShare error
      expect(result.errors.some((e) => e.field === 'channels.trafficShare')).toBe(false);
    });
  });

  describe('seasonality validation', () => {
    it('rejects wrong number of monthly multipliers', () => {
      const config = createEcommerceConfig();
      config.seasonality = {
        ...config.seasonality,
        monthly: [1, 1, 1] as unknown as typeof config.seasonality.monthly,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'seasonality.monthly')).toBe(true);
    });

    it('rejects negative multipliers', () => {
      const config = createEcommerceConfig();
      config.seasonality = {
        ...config.seasonality,
        monthly: [-0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'seasonality')).toBe(true);
    });
  });

  describe('ecommerce profile validation', () => {
    it('rejects empty products', () => {
      const config = createEcommerceConfig();
      (config.profile as EcommerceProfile).products = [];
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.products')).toBe(true);
    });

    it('rejects product with zero price', () => {
      const config = createEcommerceConfig();
      const profile = config.profile as EcommerceProfile;
      profile.products = profile.products.map((p, i) =>
        i === 0 ? { ...p, price: 0 } : p
      );
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes('price'))).toBe(true);
    });

    it('rejects funnel rate > 1', () => {
      const config = createEcommerceConfig();
      (config.profile as EcommerceProfile).funnelRates.viewToCart = 1.5;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes('viewToCart'))).toBe(true);
    });

    it('rejects avgItemsPerOrder < 1', () => {
      const config = createEcommerceConfig();
      (config.profile as EcommerceProfile).avgItemsPerOrder = 0.5;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.avgItemsPerOrder')).toBe(true);
    });
  });

  describe('subscription profile validation', () => {
    it('rejects empty plans', () => {
      const config = createSubscriptionConfig();
      (config.profile as SubscriptionProfile).plans = [];
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.plans')).toBe(true);
    });

    it('rejects plan shares not summing to ~1', () => {
      const config = createSubscriptionConfig();
      const profile = config.profile as SubscriptionProfile;
      profile.plans = [
        { id: 'a', name: 'A', monthlyPrice: 10, signupShare: 0.3 },
        { id: 'b', name: 'B', monthlyPrice: 20, signupShare: 0.3 },
        // Sum = 0.6, missing 0.4
      ];
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.plans.signupShare')).toBe(true);
    });

    it('rejects trialConversionRate > 1', () => {
      const config = createSubscriptionConfig();
      (config.profile as SubscriptionProfile).trialConversionRate = 1.2;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.trialConversionRate')).toBe(true);
    });

    it('rejects empty churn curve', () => {
      const config = createSubscriptionConfig();
      (config.profile as SubscriptionProfile).churnCurve = [];
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.churnCurve')).toBe(true);
    });
  });

  describe('leadgen profile validation', () => {
    it('rejects formStartRate > 1', () => {
      const config = createLeadgenConfig();
      (config.profile as LeadGenProfile).formStartRate = 1.5;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes('formStartRate'))).toBe(true);
    });

    it('rejects partnership distribution not summing to ~1', () => {
      const config = createLeadgenConfig();
      (config.profile as LeadGenProfile).partnershipDistribution = {
        sponsored_content: 0.5,
        product_collaboration: 0.5,
        event_sponsorship: 0.5,
        licensing: 0,
        not_sure: 0,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.partnershipDistribution')).toBe(true);
    });

    it('rejects budget distribution not summing to ~1', () => {
      const config = createLeadgenConfig();
      (config.profile as LeadGenProfile).budgetDistribution = {
        under_5k: 0.1,
        '5k_15k': 0.1,
        '15k_50k': 0.1,
        '50k_plus': 0.1,
        prefer_to_discuss: 0.1,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile.budgetDistribution')).toBe(true);
    });
  });

  describe('accumulates multiple errors', () => {
    it('returns all errors, not just the first', () => {
      const config = createEcommerceConfig({
        dailySessions: 0,
        backfillMonths: -1,
        channels: [],
      });
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
