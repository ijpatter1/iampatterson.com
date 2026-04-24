import { generateBackfill, generateDay, generateDateRange } from './generator';
import { createEcommerceConfig, createSubscriptionConfig, createLeadgenConfig } from './profiles';

describe('generator orchestrator', () => {
  describe('generateDay', () => {
    it('generates events for a single day', () => {
      const config = createEcommerceConfig({ seed: 42, dailySessions: 20 });
      const result = generateDay(config, new Date('2025-06-15'));

      expect(result.events.length).toBeGreaterThan(0);
      expect(result.stats.totalSessions).toBeGreaterThanOrEqual(1);
      expect(result.stats.totalEvents).toBe(result.events.length);
      expect(result.stats.dateRange.start).toBe('2025-06-15');
      expect(result.stats.dateRange.end).toBe('2025-06-15');
    });

    it('generates events for all three business models', () => {
      const models = [
        createEcommerceConfig({ seed: 42, dailySessions: 10 }),
        createSubscriptionConfig({ seed: 42, dailySessions: 10 }),
        createLeadgenConfig({ seed: 42, dailySessions: 10 }),
      ];

      for (const config of models) {
        const result = generateDay(config, new Date('2025-06-15'));
        expect(result.events.length).toBeGreaterThan(0);
        expect(result.stats.totalSessions).toBeGreaterThanOrEqual(1);
      }
    });

    it('event breakdown counts match total events', () => {
      const config = createEcommerceConfig({ seed: 42, dailySessions: 30 });
      const result = generateDay(config, new Date('2025-06-15'));

      const breakdownTotal = Object.values(result.stats.eventBreakdown).reduce((a, b) => a + b, 0);
      expect(breakdownTotal).toBe(result.stats.totalEvents);
    });

    it('ecommerce events include expected event types', () => {
      const config = createEcommerceConfig({ seed: 42, dailySessions: 100 });
      const result = generateDay(config, new Date('2025-06-15'));

      expect(result.stats.eventBreakdown['page_view']).toBeGreaterThan(0);
      expect(result.stats.eventBreakdown['product_view']).toBeGreaterThan(0);
      // With 100 sessions, we should get some add_to_cart and purchases
      expect(result.stats.eventBreakdown['add_to_cart']).toBeGreaterThan(0);
    });

    it('subscription events include plan_select on day-of generation', () => {
      const config = createSubscriptionConfig({ seed: 42, dailySessions: 100 });
      const result = generateDay(config, new Date('2025-06-15'));

      expect(result.stats.eventBreakdown['plan_select']).toBeGreaterThan(0);
      // Note: subscription lifecycle events (renewal, churn) are
      // monthly cadence and only appear in multi-day backfills, not
      // single-day generation, since renewals project +1mo from signup
      // and would fall past the day's endDate.
    });

    it('subscription backfill produces lifecycle events (renewal/churn)', () => {
      const config = createSubscriptionConfig({
        seed: 42,
        dailySessions: 100,
        backfillMonths: 6,
      });
      const result = generateBackfill(config, new Date('2025-06-15'));

      const hasLifecycle =
        (result.stats.eventBreakdown['subscription_renewal'] || 0) > 0 ||
        (result.stats.eventBreakdown['subscription_churn'] || 0) > 0;
      expect(hasLifecycle).toBe(true);
    });

    it('leadgen events include form-related events', () => {
      const config = createLeadgenConfig({ seed: 42, dailySessions: 50 });
      const result = generateDay(config, new Date('2025-06-15'));

      expect(result.stats.eventBreakdown['page_view']).toBeGreaterThan(0);
      // With 50 sessions, should get some form starts
      expect(result.stats.eventBreakdown['form_start']).toBeGreaterThan(0);
    });

    it('generates ad platform records', () => {
      const config = createEcommerceConfig({ seed: 42, dailySessions: 10 });
      const result = generateDay(config, new Date('2025-06-15'));

      expect(result.adPlatformRecords.length).toBeGreaterThan(0);
      expect(result.stats.totalAdRecords).toBe(result.adPlatformRecords.length);
    });
  });

  describe('generateDateRange', () => {
    it('generates events across multiple days', () => {
      const config = createEcommerceConfig({ seed: 42, dailySessions: 10 });
      const result = generateDateRange(config, new Date('2025-06-01'), new Date('2025-06-07'));

      // 7 days × ~10 sessions × seasonality multipliers
      expect(result.stats.totalSessions).toBeGreaterThan(5);
      expect(result.stats.totalSessions).toBeLessThan(200);
    });

    it('is reproducible with the same seed', () => {
      const config1 = createEcommerceConfig({ seed: 42, dailySessions: 10 });
      const config2 = createEcommerceConfig({ seed: 42, dailySessions: 10 });
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-03');

      const result1 = generateDateRange(config1, start, end);
      const result2 = generateDateRange(config2, start, end);

      expect(result1.stats.totalSessions).toBe(result2.stats.totalSessions);
      expect(result1.stats.totalEvents).toBe(result2.stats.totalEvents);
      expect(result1.events.map((e) => e.event)).toEqual(result2.events.map((e) => e.event));
    });
  });

  describe('generateBackfill', () => {
    it('generates data for the configured backfill period', () => {
      const config = createEcommerceConfig({
        seed: 42,
        dailySessions: 5,
        backfillMonths: 3,
      });
      const result = generateBackfill(config, new Date('2025-06-15'));

      // 3 months ≈ 90 days × 5 sessions × seasonality
      expect(result.stats.totalSessions).toBeGreaterThan(50);
      expect(result.stats.totalSessions).toBeLessThan(1000);
      expect(result.stats.dateRange.start).toBe('2025-03-15');
      expect(result.stats.dateRange.end).toBe('2025-06-15');
    });

    it('events have timestamps spanning the full backfill range', () => {
      const config = createEcommerceConfig({
        seed: 42,
        dailySessions: 5,
        backfillMonths: 2,
      });
      const result = generateBackfill(config, new Date('2025-06-15'));

      const timestamps = result.events.map((e) => new Date(e.timestamp as string));
      const earliest = new Date(Math.min(...timestamps.map((t) => t.getTime())));
      const latest = new Date(Math.max(...timestamps.map((t) => t.getTime())));

      // Earliest should be around April 15
      expect(earliest.getUTCMonth()).toBeLessThanOrEqual(3); // April (0-indexed)
      // Latest should be around June 15
      expect(latest.getUTCMonth()).toBeGreaterThanOrEqual(5); // June
    });

    it('ad platform records span the full date range', () => {
      const config = createEcommerceConfig({
        seed: 42,
        dailySessions: 5,
        backfillMonths: 2,
      });
      const result = generateBackfill(config, new Date('2025-06-15'));

      const dates = result.adPlatformRecords.map((r) => r.date);
      expect(dates[0]).toBe('2025-04-15');
      expect(dates[dates.length - 1]).toBe('2025-06-15');
    });

    // Phase 10c follow-up: previously the subscription engine projected up
    // to 12 months of renewal/churn events forward from each trial signup
    // with no endDate clamp, so a backfill ending 2026-04-24 produced
    // renewals through 2027-04-24. Pin: events may spill within ~1 day of
    // endDate (intra-session events that start near midnight realistically
    // cross into the next day) but must not project further forward.
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    it.each(['ecommerce', 'subscription', 'leadgen'] as const)(
      'no %s event lands more than 1 day past endDate',
      (model) => {
        const factory = {
          ecommerce: createEcommerceConfig,
          subscription: createSubscriptionConfig,
          leadgen: createLeadgenConfig,
        }[model];
        const config = factory({
          seed: 42,
          dailySessions: 50,
          backfillMonths: 3,
        });
        const endDate = new Date('2025-06-15T23:59:59.999Z');
        const cutoff = new Date(endDate.getTime() + ONE_DAY_MS);
        const result = generateBackfill(config, endDate);

        const offenders = result.events
          .map((e) => ({ event: e.event, ts: new Date(e.timestamp as string) }))
          .filter((o) => o.ts > cutoff);

        expect(offenders).toEqual([]);
      },
    );
  });

  describe('growth over time', () => {
    it('later months in a backfill have more sessions than earlier months', () => {
      const config = createEcommerceConfig({
        seed: 42,
        dailySessions: 20,
        backfillMonths: 6,
        monthlyGrowthRate: 0.15, // 15% growth for clear signal
        seasonality: flatSeasonality(),
      });

      // Generate a 6-month backfill and count events per month
      const result = generateBackfill(config, new Date('2025-06-30'));
      const eventsByMonth: Record<string, number> = {};
      for (const event of result.events) {
        const month = (event as { timestamp: string }).timestamp.substring(0, 7); // "YYYY-MM"
        eventsByMonth[month] = (eventsByMonth[month] || 0) + 1;
      }

      const months = Object.keys(eventsByMonth).sort();
      expect(months.length).toBeGreaterThanOrEqual(4);
      // Last month should have more events than first month due to growth
      const firstMonthEvents = eventsByMonth[months[0]];
      const lastMonthEvents = eventsByMonth[months[months.length - 1]];
      expect(lastMonthEvents).toBeGreaterThan(firstMonthEvents);
    });
  });
});

/** Flat seasonality for predictable tests. */
function flatSeasonality() {
  return {
    monthly: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ],
    dayOfWeek: [1, 1, 1, 1, 1, 1, 1] as [number, number, number, number, number, number, number],
    hourOfDay: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ],
  };
}
