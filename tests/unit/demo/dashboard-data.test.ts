/**
 * @jest-environment jsdom
 */
import {
  ecommerceDashboardData,
  subscriptionDashboardData,
  leadGenDashboardData,
} from '@/lib/demo/dashboard-data';
import type {
  EcommerceDashboardData,
  SubscriptionDashboardData,
  LeadGenDashboardData,
  KpiMetric,
  FunnelStep,
  CohortData,
} from '@/lib/demo/dashboard-types';

describe('Dashboard mock data', () => {
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

  describe('Subscription data', () => {
    it('has 4 KPI metrics', () => {
      expect(subscriptionDashboardData.kpis).toHaveLength(4);
    });

    it('has MRR trend showing growth', () => {
      const mrr = subscriptionDashboardData.mrrTrend;
      expect(mrr.length).toBeGreaterThanOrEqual(12);
      // Overall trend should be upward
      expect(mrr[mrr.length - 1].value).toBeGreaterThan(mrr[0].value);
    });

    it('has cohort retention data with decreasing retention', () => {
      subscriptionDashboardData.cohortRetention.forEach((cohort: CohortData) => {
        expect(cohort.signups).toBeGreaterThan(0);
        expect(cohort.retentionByMonth[0]).toBe(100);
        for (let i = 1; i < cohort.retentionByMonth.length; i++) {
          expect(cohort.retentionByMonth[i]).toBeLessThanOrEqual(cohort.retentionByMonth[i - 1]);
        }
      });
    });

    it('has churn breakdown summing to ~100%', () => {
      const total = subscriptionDashboardData.churnBreakdown.reduce(
        (sum, c) => sum + c.percentage,
        0,
      );
      expect(total).toBeCloseTo(100, 0);
    });

    it('has LTV by source with positive values', () => {
      subscriptionDashboardData.ltvBySource.forEach((row) => {
        expect(row.avgLtv).toBeGreaterThan(0);
        expect(row.customers).toBeGreaterThan(0);
      });
    });
  });

  describe('Lead gen data', () => {
    it('has 4 KPI metrics', () => {
      expect(leadGenDashboardData.kpis).toHaveLength(4);
    });

    it('has lead funnel with decreasing values', () => {
      const funnel = leadGenDashboardData.funnel;
      expect(funnel.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < funnel.length; i++) {
        expect(funnel[i].value).toBeLessThan(funnel[i - 1].value);
      }
    });

    it('has cost per lead by channel', () => {
      expect(leadGenDashboardData.costPerLeadByChannel.length).toBeGreaterThan(0);
      leadGenDashboardData.costPerLeadByChannel.forEach((row) => {
        expect(row.leads).toBeGreaterThan(0);
      });
    });

    it('has quality distribution summing to ~100%', () => {
      const total = leadGenDashboardData.qualityDistribution.reduce(
        (sum, q) => sum + q.percentage,
        0,
      );
      expect(total).toBeCloseTo(100, 0);
    });
  });
});
