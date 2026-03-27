/**
 * Subscription session engine — generates events simulating a visitor
 * browsing plans, signing up for a trial, and the lifecycle events
 * that follow (renewal, churn, upgrade/downgrade).
 */

import type {
  SubscriptionProfile,
  SubscriptionPlan,
  SyntheticEvent,
  SyntheticPageViewEvent,
  PlanSelectEvent,
  TrialSignupEvent,
  SubscriptionRenewalEvent,
  SubscriptionChurnEvent,
} from '../types';
import type { SessionContext } from '../session';
import { createBaseEvent } from '../session';
import { SeededRandom } from '../random';

/**
 * Generate events for one subscription session (initial visit).
 *
 * Funnel: page_view → plan_select → trial_signup
 * Not all visitors convert — most will just browse plans.
 */
export function generateSubscriptionSession(
  ctx: SessionContext,
  profile: SubscriptionProfile,
  rng: SeededRandom,
): SyntheticEvent[] {
  const events: SyntheticEvent[] = [];
  let offsetMs = 0;

  // 1. Landing page view
  const pageView: SyntheticPageViewEvent = {
    ...createBaseEvent(ctx, 'page_view', offsetMs),
    event: 'page_view',
    page_referrer: ctx.utmSource === '(direct)' ? '' : `https://${ctx.utmSource || 'google'}.com`,
  };
  events.push(pageView);
  offsetMs += rng.int(3000, 10000);

  // 2. Plan selection (browsing plans)
  const plan = selectPlan(profile.plans, rng);
  const planSelect: PlanSelectEvent = {
    ...createBaseEvent(ctx, 'plan_select', offsetMs),
    event: 'plan_select',
    page_path: `/demo/subscription/plans/${plan.id}`,
    page_title: `${plan.name} - Tuna Subscription Box`,
    plan_id: plan.id,
    plan_name: plan.name,
    plan_price: plan.monthlyPrice,
  };
  events.push(planSelect);
  offsetMs += rng.int(5000, 20000);

  // 3. Trial signup (conversion gate — ~15% of visitors sign up)
  if (!rng.chance(0.15)) {
    return events; // Browsed but didn't sign up
  }

  const trialSignup: TrialSignupEvent = {
    ...createBaseEvent(ctx, 'trial_signup', offsetMs),
    event: 'trial_signup',
    page_path: '/demo/subscription/signup',
    page_title: 'Start Your Trial',
    plan_id: plan.id,
    plan_name: plan.name,
    plan_price: plan.monthlyPrice,
  };
  events.push(trialSignup);

  return events;
}

/**
 * Generate lifecycle events for a subscriber over time.
 *
 * Called separately from the initial session — these represent
 * renewal/churn events that happen on a monthly cadence.
 */
export function generateSubscriptionLifecycle(
  ctx: SessionContext,
  profile: SubscriptionProfile,
  plan: SubscriptionPlan,
  startDate: Date,
  months: number,
  rng: SeededRandom,
): SyntheticEvent[] {
  const events: SyntheticEvent[] = [];

  // First check: does trial convert to paid?
  if (!rng.chance(profile.trialConversionRate)) {
    // Trial churned — generate a churn event at month 1
    const churnDate = new Date(startDate);
    churnDate.setMonth(churnDate.getMonth() + 1);
    const churnCtx = { ...ctx, timestamp: churnDate };
    const churn: SubscriptionChurnEvent = {
      ...createBaseEvent(churnCtx, 'subscription_churn', 0),
      event: 'subscription_churn',
      page_path: '/demo/subscription/account',
      page_title: 'Account Dashboard',
      plan_id: plan.id,
      plan_name: plan.name,
      tenure_months: 0,
      reason: 'trial_expired',
    };
    events.push(churn);
    return events;
  }

  // Generate monthly renewal/churn events
  let currentPlan = plan;
  for (let month = 1; month <= months; month++) {
    const eventDate = new Date(startDate);
    eventDate.setMonth(eventDate.getMonth() + month);
    const monthCtx = { ...ctx, timestamp: eventDate };

    // Check churn
    const churnIdx = Math.min(month - 1, profile.churnCurve.length - 1);
    const churnRate = profile.churnCurve[churnIdx];

    if (rng.chance(churnRate)) {
      const reasons = ['too_expensive', 'not_using', 'found_alternative', 'moving', 'other'];
      const churn: SubscriptionChurnEvent = {
        ...createBaseEvent(monthCtx, 'subscription_churn', 0),
        event: 'subscription_churn',
        page_path: '/demo/subscription/account',
        page_title: 'Account Dashboard',
        plan_id: currentPlan.id,
        plan_name: currentPlan.name,
        tenure_months: month,
        reason: rng.pick(reasons),
      };
      events.push(churn);
      return events; // Subscriber is gone
    }

    // Renewal
    const renewal: SubscriptionRenewalEvent = {
      ...createBaseEvent(monthCtx, 'subscription_renewal', 0),
      event: 'subscription_renewal',
      page_path: '/demo/subscription/account',
      page_title: 'Account Dashboard',
      plan_id: currentPlan.id,
      plan_name: currentPlan.name,
      renewal_month: month,
      revenue: currentPlan.monthlyPrice,
    };
    events.push(renewal);

    // Check for upgrade/downgrade
    if (
      rng.chance(profile.upgradeRate) &&
      currentPlan.monthlyPrice < Math.max(...profile.plans.map((p) => p.monthlyPrice))
    ) {
      const higherPlans = profile.plans.filter((p) => p.monthlyPrice > currentPlan.monthlyPrice);
      if (higherPlans.length > 0) {
        currentPlan = rng.pick(higherPlans);
      }
    } else if (
      rng.chance(profile.downgradeRate) &&
      currentPlan.monthlyPrice > Math.min(...profile.plans.map((p) => p.monthlyPrice))
    ) {
      const lowerPlans = profile.plans.filter((p) => p.monthlyPrice < currentPlan.monthlyPrice);
      if (lowerPlans.length > 0) {
        currentPlan = rng.pick(lowerPlans);
      }
    }
  }

  return events;
}

/**
 * Select a plan weighted by signup share.
 */
function selectPlan(plans: SubscriptionPlan[], rng: SeededRandom): SubscriptionPlan {
  const items: Array<readonly [SubscriptionPlan, number]> = plans.map((p) => [p, p.signupShare]);
  return rng.weighted(items);
}
