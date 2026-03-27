import { generateSubscriptionSession, generateSubscriptionLifecycle } from './subscription';
import { createSessionContext } from '../session';
import { createSubscriptionConfig } from '../profiles';
import { SeededRandom } from '../random';
import type {
  SubscriptionProfile,
  PlanSelectEvent,
  TrialSignupEvent,
  SubscriptionRenewalEvent,
  SubscriptionChurnEvent,
  SyntheticBaseEvent,
} from '../types';

function makeSession(seed = 42) {
  const config = createSubscriptionConfig({ seed });
  const rng = new SeededRandom(seed);
  const timestamp = new Date('2025-06-15T14:00:00Z');
  const ctx = createSessionContext(config, timestamp, rng);
  return { config, rng, ctx, profile: config.profile as SubscriptionProfile };
}

describe('generateSubscriptionSession', () => {
  it('always starts with a page_view event', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateSubscriptionSession(ctx, profile, rng);
    expect(events[0].event).toBe('page_view');
  });

  it('includes a plan_select event with valid plan details', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateSubscriptionSession(ctx, profile, rng);
    const planSelects = events.filter((e) => e.event === 'plan_select') as PlanSelectEvent[];
    expect(planSelects).toHaveLength(1);
    const ps = planSelects[0];
    expect(profile.plans.some((p) => p.id === ps.plan_id)).toBe(true);
    expect(ps.plan_price).toBeGreaterThan(0);
    expect(ps.page_path).toContain('/demo/subscription/plans/');
  });

  it('all events share the same session_id', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateSubscriptionSession(ctx, profile, rng);
    for (const event of events) {
      expect((event as SyntheticBaseEvent).session_id).toBe(ctx.sessionId);
    }
  });

  describe('funnel behavior over many sessions', () => {
    it('most sessions do not convert to trial_signup', () => {
      let signups = 0;
      const n = 1000;
      for (let seed = 0; seed < n; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateSubscriptionSession(ctx, profile, rng);
        if (events.some((e) => e.event === 'trial_signup')) signups++;
      }
      // ~15% signup rate
      expect(signups / n).toBeGreaterThan(0.08);
      expect(signups / n).toBeLessThan(0.25);
    });

    it('Good Boy plan is selected most often', () => {
      const planCounts: Record<string, number> = {};
      const n = 2000;
      for (let seed = 0; seed < n; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateSubscriptionSession(ctx, profile, rng);
        const planSelect = events.find((e) => e.event === 'plan_select') as
          | PlanSelectEvent
          | undefined;
        if (planSelect) {
          planCounts[planSelect.plan_id] = (planCounts[planSelect.plan_id] || 0) + 1;
        }
      }
      expect(planCounts['good-boy']).toBeGreaterThan(planCounts['pup'] || 0);
      expect(planCounts['good-boy']).toBeGreaterThan(planCounts['big-tuna'] || 0);
    });
  });
});

describe('generateSubscriptionLifecycle', () => {
  it('generates churn event for trial that does not convert', () => {
    // Set trialConversionRate to 0 to guarantee non-conversion
    const config = createSubscriptionConfig();
    const profile = config.profile as SubscriptionProfile;
    profile.trialConversionRate = 0;
    const rng = new SeededRandom(42);
    const ctx = createSessionContext(config, new Date('2025-06-15T14:00:00Z'), rng);
    const plan = profile.plans[0];

    const events = generateSubscriptionLifecycle(
      ctx,
      profile,
      plan,
      new Date('2025-06-15'),
      12,
      rng,
    );
    expect(events).toHaveLength(1);
    const churn = events[0] as SubscriptionChurnEvent;
    expect(churn.event).toBe('subscription_churn');
    expect(churn.reason).toBe('trial_expired');
    expect(churn.tenure_months).toBe(0);
  });

  it('generates renewal events for converting subscribers', () => {
    const config = createSubscriptionConfig();
    const profile = config.profile as SubscriptionProfile;
    profile.trialConversionRate = 1; // Force conversion
    profile.churnCurve = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // No churn
    const rng = new SeededRandom(42);
    const ctx = createSessionContext(config, new Date('2025-01-15T14:00:00Z'), rng);
    const plan = profile.plans[1]; // Good Boy

    const events = generateSubscriptionLifecycle(
      ctx,
      profile,
      plan,
      new Date('2025-01-15'),
      6,
      rng,
    );
    const renewals = events.filter(
      (e) => e.event === 'subscription_renewal',
    ) as SubscriptionRenewalEvent[];
    expect(renewals).toHaveLength(6);

    // Verify renewal months are sequential
    for (let i = 0; i < renewals.length; i++) {
      expect(renewals[i].renewal_month).toBe(i + 1);
      expect(renewals[i].revenue).toBeGreaterThan(0);
    }
  });

  it('churn terminates the lifecycle', () => {
    const config = createSubscriptionConfig();
    const profile = config.profile as SubscriptionProfile;
    profile.trialConversionRate = 1;
    profile.churnCurve = [1]; // 100% churn at month 1
    const rng = new SeededRandom(42);
    const ctx = createSessionContext(config, new Date('2025-01-15T14:00:00Z'), rng);
    const plan = profile.plans[0];

    const events = generateSubscriptionLifecycle(
      ctx,
      profile,
      plan,
      new Date('2025-01-15'),
      12,
      rng,
    );
    // Should have churn event but no more renewals
    const churnEvents = events.filter((e) => e.event === 'subscription_churn');
    expect(churnEvents).toHaveLength(1);
    const renewals = events.filter((e) => e.event === 'subscription_renewal');
    expect(renewals).toHaveLength(0);
  });

  it('realistic lifecycle has early churn and decreasing rates', () => {
    const config = createSubscriptionConfig();
    const profile = config.profile as SubscriptionProfile;
    profile.trialConversionRate = 1;
    const rng = new SeededRandom(42);

    let totalMonths = 0;
    let churned = 0;
    const n = 500;
    for (let seed = 0; seed < n; seed++) {
      const r = new SeededRandom(seed);
      const ctx = createSessionContext(config, new Date('2025-01-15T14:00:00Z'), r);
      const plan = profile.plans[1];
      const events = generateSubscriptionLifecycle(
        ctx,
        profile,
        plan,
        new Date('2025-01-15'),
        12,
        r,
      );
      const renewals = events.filter((e) => e.event === 'subscription_renewal');
      const churn = events.filter((e) => e.event === 'subscription_churn');
      totalMonths += renewals.length;
      if (churn.length > 0) churned++;
    }

    // Some subscribers should churn, but not all
    expect(churned).toBeGreaterThan(n * 0.2);
    expect(churned).toBeLessThan(n * 0.9);
    // Average tenure should be > 3 months
    expect(totalMonths / n).toBeGreaterThan(3);
  });
});
