import {
  createConfig,
  createEcommerceConfig,
  createSubscriptionConfig,
  createLeadgenConfig,
} from './profiles';
import { COMPANY_NAMES } from './engines/leadgen';
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
        expect.arrayContaining([
          'tuna-plush',
          'tuna-calendar',
          'tuna-pin-set',
          'tuna-tote',
          'tuna-ornament',
          'tuna-mug',
        ]),
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
      expect(profile.churnCurve[0]).toBeGreaterThan(
        profile.churnCurve[profile.churnCurve.length - 1],
      );
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
        expect.arrayContaining([
          'sponsored_content',
          'product_collaboration',
          'event_sponsorship',
          'licensing',
          'not_sure',
        ]),
      );
    });

    it('has all budget ranges defined', () => {
      const config = createLeadgenConfig();
      const profile = config.profile as LeadGenProfile;
      expect(Object.keys(profile.budgetDistribution)).toEqual(
        expect.arrayContaining(['under_5k', '5k_15k', '15k_50k', '50k_plus', 'prefer_to_discuss']),
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

  // Phase 10c D1: Tuna is a chiweenie, not a cat. Earlier LLM-assisted
  // generator content drifted into off-brand audience labels ("Cat Lovers",
  // "Cat Content", "Cat Subscription Box") that shipped to BigQuery before
  // anyone noticed. This pin walks every campaign + UTM variant + product
  // + plan name across all three configs and bans the off-brand vocabulary
  // so that class of drift can't silently recur.
  describe('brand vocabulary pin', () => {
    // Substring match (case-insensitive) rather than word-boundary, so the
    // snake_case + ALL_CAPS UTM variants (e.g. `google_prosp_catlovers`,
    // `META_BROAD_CAT`) are caught too. The label dataset is small and
    // author-controlled, so false positives (`category`, `catalog`) would
    // require a real off-brand intent to land here, not an English-word
    // accident. Add other off-brand vocabulary here as it surfaces.
    const FORBIDDEN = ['cat', 'feline', 'kitten'];

    function collectLabels(config: ReturnType<typeof createConfig>): string[] {
      const labels: string[] = [];
      for (const channel of config.channels) {
        for (const campaign of channel.campaigns) {
          labels.push(campaign.name);
          labels.push(...campaign.utmVariants);
        }
      }
      const profile = config.profile;
      if (profile.model === 'ecommerce') {
        labels.push(...profile.products.map((p) => p.name));
        labels.push(...profile.products.map((p) => p.id));
      } else if (profile.model === 'subscription') {
        labels.push(...profile.plans.map((p) => p.name));
        labels.push(...profile.plans.map((p) => p.id));
      }
      return labels;
    }

    it.each(['ecommerce', 'subscription', 'leadgen'] as const)(
      '%s config has no cat/feline vocabulary in campaign or product labels',
      (model) => {
        const config = createConfig(model);
        const labels = collectLabels(config);
        const offenders = labels.filter((label) => {
          const lower = label.toLowerCase();
          return FORBIDDEN.some((token) => lower.includes(token));
        });
        expect(offenders).toEqual([]);
      },
    );

    // Phase 10c Pass-1 fix: extend the pin to walk COMPANY_NAMES in
    // engines/leadgen.ts. Previously this pin only walked profiles.ts
    // and silently exempted the leadgen B2B-partner-company list, where
    // the same LLM hallucination class shipped 'Feline First',
    // 'Catitude Brands', and 'Purrfect Partners' to events_raw via the
    // form_complete.company_name field.
    it('engines/leadgen.ts COMPANY_NAMES has no cat/feline vocabulary', () => {
      const offenders = COMPANY_NAMES.filter((name) => {
        const lower = name.toLowerCase();
        return FORBIDDEN.some((token) => lower.includes(token));
      });
      expect(offenders).toEqual([]);
    });
  });
});
