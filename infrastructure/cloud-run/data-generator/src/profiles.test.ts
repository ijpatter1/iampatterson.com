import {
  createConfig,
  createEcommerceConfig,
  createSubscriptionConfig,
  createLeadgenConfig,
} from './profiles';
import type { EcommerceProfile, SubscriptionProfile, LeadGenProfile } from './types';

describe('profiles', () => {
  describe('createEcommerceConfig', () => {
    it('returns a config with ecommerce businessModel', () => {
      const config = createEcommerceConfig();
      expect(config.businessModel).toBe('ecommerce');
      expect(config.profile.model).toBe('ecommerce');
    });

    it('includes all 6 Tuna Shop products', () => {
      const config = createEcommerceConfig();
      const profile = config.profile as EcommerceProfile;
      expect(profile.products).toHaveLength(6);
      expect(profile.products.map((p) => p.id)).toEqual(
        expect.arrayContaining(['tuna-plush', 'tuna-calendar', 'tuna-pin-set', 'tuna-tote', 'tuna-ornament', 'tuna-mug'])
      );
    });

    it('has correct product prices from content guide', () => {
      const config = createEcommerceConfig();
      const profile = config.profile as EcommerceProfile;
      const plush = profile.products.find((p) => p.id === 'tuna-plush');
      expect(plush?.price).toBe(24.99);
      const calendar = profile.products.find((p) => p.id === 'tuna-calendar');
      expect(calendar?.price).toBe(19.99);
    });

    it('has channels covering all platform types', () => {
      const config = createEcommerceConfig();
      const platforms = config.channels.map((c) => c.platform);
      expect(platforms).toContain('google');
      expect(platforms).toContain('meta');
      expect(platforms).toContain('tiktok');
      expect(platforms).toContain('email');
      expect(platforms).toContain('organic');
      expect(platforms).toContain('direct');
    });

    it('has campaigns with multiple UTM variants (intentional inconsistencies)', () => {
      const config = createEcommerceConfig();
      const googleChannel = config.channels.find((c) => c.platform === 'google');
      expect(googleChannel).toBeDefined();
      for (const campaign of googleChannel!.campaigns) {
        expect(campaign.utmVariants.length).toBeGreaterThanOrEqual(3);
        // Variants should differ (inconsistent naming)
        const unique = new Set(campaign.utmVariants);
        expect(unique.size).toBe(campaign.utmVariants.length);
      }
    });

    it('accepts overrides', () => {
      const config = createEcommerceConfig({ dailySessions: 500 });
      expect(config.dailySessions).toBe(500);
      expect(config.businessModel).toBe('ecommerce');
    });
  });

  describe('createSubscriptionConfig', () => {
    it('returns a config with subscription businessModel', () => {
      const config = createSubscriptionConfig();
      expect(config.businessModel).toBe('subscription');
      expect(config.profile.model).toBe('subscription');
    });

    it('includes all 3 subscription plans with correct prices', () => {
      const config = createSubscriptionConfig();
      const profile = config.profile as SubscriptionProfile;
      expect(profile.plans).toHaveLength(3);

      const pup = profile.plans.find((p) => p.id === 'pup');
      expect(pup?.monthlyPrice).toBe(19.99);
      expect(pup?.name).toBe('The Pup');

      const goodBoy = profile.plans.find((p) => p.id === 'good-boy');
      expect(goodBoy?.monthlyPrice).toBe(34.99);

      const bigTuna = profile.plans.find((p) => p.id === 'big-tuna');
      expect(bigTuna?.monthlyPrice).toBe(49.99);
    });

    it('Good Boy plan has the highest signup share', () => {
      const config = createSubscriptionConfig();
      const profile = config.profile as SubscriptionProfile;
      const goodBoy = profile.plans.find((p) => p.id === 'good-boy');
      const maxShare = Math.max(...profile.plans.map((p) => p.signupShare));
      expect(goodBoy?.signupShare).toBe(maxShare);
    });

    it('churn curve decreases over time', () => {
      const config = createSubscriptionConfig();
      const profile = config.profile as SubscriptionProfile;
      // First month churn should be higher than last month
      expect(profile.churnCurve[0]).toBeGreaterThan(profile.churnCurve[profile.churnCurve.length - 1]);
    });
  });

  describe('createLeadgenConfig', () => {
    it('returns a config with leadgen businessModel', () => {
      const config = createLeadgenConfig();
      expect(config.businessModel).toBe('leadgen');
      expect(config.profile.model).toBe('leadgen');
    });

    it('has all partnership types defined', () => {
      const config = createLeadgenConfig();
      const profile = config.profile as LeadGenProfile;
      expect(Object.keys(profile.partnershipDistribution)).toEqual(
        expect.arrayContaining(['sponsored_content', 'product_collaboration', 'event_sponsorship', 'licensing', 'not_sure'])
      );
    });

    it('has all budget ranges defined', () => {
      const config = createLeadgenConfig();
      const profile = config.profile as LeadGenProfile;
      expect(Object.keys(profile.budgetDistribution)).toEqual(
        expect.arrayContaining(['under_5k', '5k_15k', '15k_50k', '50k_plus', 'prefer_to_discuss'])
      );
    });

    it('uses B2B seasonality with lower weekends', () => {
      const config = createLeadgenConfig();
      const sunday = config.seasonality.dayOfWeek[0];
      const tuesday = config.seasonality.dayOfWeek[2];
      expect(sunday).toBeLessThan(tuesday);
      // B2B weekends should be significantly lower
      expect(sunday).toBeLessThan(0.5);
    });

    it('has lower daily sessions than ecommerce (B2B = less volume)', () => {
      const ecom = createEcommerceConfig();
      const lead = createLeadgenConfig();
      expect(lead.dailySessions).toBeLessThan(ecom.dailySessions);
    });
  });

  describe('createConfig', () => {
    it('dispatches to the correct profile factory', () => {
      expect(createConfig('ecommerce').profile.model).toBe('ecommerce');
      expect(createConfig('subscription').profile.model).toBe('subscription');
      expect(createConfig('leadgen').profile.model).toBe('leadgen');
    });

    it('passes overrides through', () => {
      const config = createConfig('ecommerce', { dailySessions: 999 });
      expect(config.dailySessions).toBe(999);
    });
  });
});
