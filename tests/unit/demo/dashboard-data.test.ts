/**
 * @jest-environment jsdom
 */
import { ecommerceDashboardData } from '@/lib/demo/dashboard-data';
import type { KpiMetric } from '@/lib/demo/dashboard-types';

// Phase 9E deliverable 7 removed the subscription + lead gen dashboard
// bundles (`subscriptionDashboardData`, `leadGenDashboardData`) along
// with the demos themselves. Their prior tests lived in this file and
// have been deleted; the ecommerce dashboard block persists verbatim.

describe('Dashboard mock data, ecommerce (post-9E-D7)', () => {
  describe('E-commerce data', () => {
    it('has 4 KPI metrics', () => {
      expect(ecommerceDashboardData.kpis).toHaveLength(4);
      ecommerceDashboardData.kpis.forEach((kpi: KpiMetric) => {
        expect(kpi.label).toBeTruthy();
        expect(kpi.value).toBeTruthy();
        expect(typeof kpi.change).toBe('number');
      });
    });

    it('has 18 months of revenue trend data', () => {
      expect(ecommerceDashboardData.revenueTrend.length).toBeGreaterThanOrEqual(12);
      ecommerceDashboardData.revenueTrend.forEach((point) => {
        expect(point.date).toMatch(/^\d{4}-\d{2}$/);
        expect(point.value).toBeGreaterThan(0);
      });
    });

    it('has channel breakdown with required fields', () => {
      expect(ecommerceDashboardData.channelBreakdown.length).toBeGreaterThan(0);
      ecommerceDashboardData.channelBreakdown.forEach((ch) => {
        expect(ch.channel).toBeTruthy();
        expect(ch.sessions).toBeGreaterThan(0);
        expect(typeof ch.conversionRate).toBe('number');
      });
    });

    it('has product performance for all 6 products', () => {
      expect(ecommerceDashboardData.productPerformance).toHaveLength(6);
      ecommerceDashboardData.productPerformance.forEach((p) => {
        expect(p.views).toBeGreaterThan(0);
        expect(p.purchases).toBeLessThanOrEqual(p.addToCarts);
        expect(p.addToCarts).toBeLessThanOrEqual(p.views);
      });
    });

    it('has acquisition funnel with decreasing values', () => {
      const funnel = ecommerceDashboardData.acquisitionFunnel;
      expect(funnel.length).toBeGreaterThanOrEqual(4);
      for (let i = 1; i < funnel.length; i++) {
        expect(funnel[i].value).toBeLessThan(funnel[i - 1].value);
      }
    });

    it('has campaign performance rows', () => {
      expect(ecommerceDashboardData.campaignPerformance.length).toBeGreaterThan(0);
      ecommerceDashboardData.campaignPerformance.forEach((row) => {
        expect(row.business_model).toBe('ecommerce');
        expect(row.platform).toBeTruthy();
        expect(row.spend_usd).toBeGreaterThan(0);
      });
    });
  });
});
