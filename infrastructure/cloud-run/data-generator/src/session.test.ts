import {
  getSeasonalityMultiplier,
  getSessionCountForDate,
  selectChannel,
  selectCampaign,
  createSessionContext,
  createBaseEvent,
} from './session';
import { createEcommerceConfig } from './profiles';
import { SeededRandom } from './random';
import type { SeasonalityConfig } from './types';

describe('session utilities', () => {
  describe('getSeasonalityMultiplier', () => {
    it('returns the product of month, day-of-week, and hour multipliers', () => {
      const config = createEcommerceConfig();
      // 2025-06-15 is a Sunday (day 0), month index 5 (June), at 14:00
      const date = new Date('2025-06-15T14:00:00Z');
      const result = getSeasonalityMultiplier(date, config.seasonality);

      const expected =
        config.seasonality.monthly[5] * // June = 0.95
        config.seasonality.dayOfWeek[0] * // Sunday = 0.7
        config.seasonality.hourOfDay[14]; // 14:00 = 1.0

      expect(result).toBeCloseTo(expected, 5);
    });

    it('returns higher multiplier for holiday months', () => {
      const config = createEcommerceConfig();
      // Compare June vs December at the same time
      const june = new Date('2025-06-10T12:00:00Z'); // Tuesday
      const december = new Date('2025-12-09T12:00:00Z'); // Tuesday
      const juneMultiplier = getSeasonalityMultiplier(june, config.seasonality);
      const decMultiplier = getSeasonalityMultiplier(december, config.seasonality);
      expect(decMultiplier).toBeGreaterThan(juneMultiplier);
    });
  });

  describe('getSessionCountForDate', () => {
    it('returns baseline sessions for the reference date', () => {
      const config = createEcommerceConfig();
      // Override seasonality to flat for predictable test
      config.seasonality = flatSeasonality();
      const refDate = new Date('2025-01-01T12:00:00Z');
      const count = getSessionCountForDate(refDate, config, refDate);
      expect(count).toBe(config.dailySessions);
    });

    it('applies growth over time', () => {
      const config = createEcommerceConfig();
      config.seasonality = flatSeasonality();
      const refDate = new Date('2024-01-01T12:00:00Z');
      const laterDate = new Date('2025-01-01T12:00:00Z'); // 12 months later
      const baseCount = getSessionCountForDate(refDate, config, refDate);
      const laterCount = getSessionCountForDate(laterDate, config, refDate);
      expect(laterCount).toBeGreaterThan(baseCount);
    });

    it('never returns less than 1', () => {
      const config = createEcommerceConfig({ dailySessions: 1, monthlyGrowthRate: -0.5 });
      config.seasonality = flatSeasonality();
      const refDate = new Date('2024-01-01T12:00:00Z');
      const laterDate = new Date('2026-01-01T12:00:00Z');
      const count = getSessionCountForDate(laterDate, config, refDate);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('selectChannel', () => {
    it('returns channels proportional to traffic share over many picks', () => {
      const config = createEcommerceConfig();
      const rng = new SeededRandom(42);
      const counts: Record<string, number> = {};
      const n = 5000;

      for (let i = 0; i < n; i++) {
        const ch = selectChannel(config.channels, rng);
        counts[ch.platform] = (counts[ch.platform] || 0) + 1;
      }

      // Meta has highest share (0.35), direct has lowest (0.05)
      const metaShare = (counts['meta'] || 0) / n;
      const directShare = (counts['direct'] || 0) / n;
      expect(metaShare).toBeGreaterThan(directShare);
      expect(metaShare).toBeGreaterThan(0.25);
      expect(directShare).toBeLessThan(0.1);
    });
  });

  describe('selectCampaign', () => {
    it('returns null for channels with no campaigns', () => {
      const config = createEcommerceConfig();
      const organic = config.channels.find((c) => c.platform === 'organic')!;
      const rng = new SeededRandom(42);
      expect(selectCampaign(organic, rng)).toBeNull();
    });

    it('returns a campaign for channels with campaigns', () => {
      const config = createEcommerceConfig();
      const google = config.channels.find((c) => c.platform === 'google')!;
      const rng = new SeededRandom(42);
      const campaign = selectCampaign(google, rng);
      expect(campaign).not.toBeNull();
      expect(campaign!.name).toBeTruthy();
    });
  });

  describe('createSessionContext', () => {
    it('returns a context with a valid session ID', () => {
      const config = createEcommerceConfig();
      const rng = new SeededRandom(42);
      const ctx = createSessionContext(config, new Date('2025-06-15T14:00:00Z'), rng);
      expect(ctx.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('sets correct page path for ecommerce model', () => {
      const config = createEcommerceConfig();
      const rng = new SeededRandom(42);
      const ctx = createSessionContext(config, new Date('2025-06-15T14:00:00Z'), rng);
      expect(ctx.pagePath).toBe('/demo/ecommerce');
      expect(ctx.pageTitle).toBe('The Tuna Shop');
    });

    it('assigns UTM params based on selected channel', () => {
      const config = createEcommerceConfig();
      // Run until we get a google channel
      for (let seed = 0; seed < 50; seed++) {
        const rng = new SeededRandom(seed);
        const ctx = createSessionContext(config, new Date('2025-06-15T14:00:00Z'), rng);
        if (ctx.channel.platform === 'google') {
          expect(ctx.utmSource).toBe('google');
          expect(ctx.utmMedium).toBe('cpc');
          expect(ctx.utmCampaign).toBeTruthy();
          break;
        }
      }
    });
  });

  describe('createBaseEvent', () => {
    it('creates an event with all required fields', () => {
      const config = createEcommerceConfig();
      const rng = new SeededRandom(42);
      const ctx = createSessionContext(config, new Date('2025-06-15T14:00:00Z'), rng);
      const event = createBaseEvent(ctx, 'test_event', 0);

      expect(event.iap_source).toBe(true);
      expect(event.event).toBe('test_event');
      expect(event.session_id).toBe(ctx.sessionId);
      expect(event.iap_session_id).toBe(ctx.sessionId);
      expect(event.page_path).toBe(ctx.pagePath);
      expect(event.page_title).toBe(ctx.pageTitle);
      expect(event.consent_analytics).toBe(ctx.consentAnalytics);
      expect(event.consent_marketing).toBe(ctx.consentMarketing);
      expect(event.consent_preferences).toBe(ctx.consentPreferences);
    });

    it('offsets timestamp by the given milliseconds', () => {
      const config = createEcommerceConfig();
      const rng = new SeededRandom(42);
      const baseTime = new Date('2025-06-15T14:00:00Z');
      const ctx = createSessionContext(config, baseTime, rng);
      const event = createBaseEvent(ctx, 'test', 5000);
      const eventTime = new Date(event.timestamp).getTime();
      expect(eventTime).toBe(baseTime.getTime() + 5000);
    });

    it('omits UTM params for direct traffic', () => {
      const config = createEcommerceConfig();
      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRandom(seed);
        const ctx = createSessionContext(config, new Date('2025-06-15T14:00:00Z'), rng);
        if (ctx.channel.platform === 'direct') {
          const event = createBaseEvent(ctx, 'test', 0);
          expect(event.utm_source).toBeUndefined();
          expect(event.utm_medium).toBeUndefined();
          expect(event.utm_campaign).toBeUndefined();
          break;
        }
      }
    });
  });
});

/** Helper: creates a flat seasonality config (all 1.0) for predictable tests. */
function flatSeasonality(): SeasonalityConfig {
  return {
    monthly: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    dayOfWeek: [1, 1, 1, 1, 1, 1, 1],
    hourOfDay: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  };
}
