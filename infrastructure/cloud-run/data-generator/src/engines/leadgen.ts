/**
 * Lead gen session engine — generates events simulating a visitor
 * browsing the Tuna Brand Partnerships page, starting a form,
 * completing it, and the subsequent lead qualification.
 */

import type {
  LeadGenProfile,
  PartnershipType,
  BudgetRange,
  SyntheticEvent,
  SyntheticPageViewEvent,
  FormCompleteEvent,
  LeadQualifyEvent,
  SyntheticBaseEvent,
} from '../types';
import type { SessionContext } from '../session';
import { createBaseEvent } from '../session';
import { SeededRandom } from '../random';

// Exported so the brand-vocabulary regression pin in profiles.test.ts
// can walk it alongside the campaign + product label sets.
export const COMPANY_NAMES = [
  'Acme Pet Co',
  'Pawsome Brands',
  'FurEver Friends',
  'Whisker Works',
  'PetVenture Inc',
  'Animal House Media',
  'Pawfect Partners',
  'Wild Side Co',
  'Tail Waggers Ltd',
  'Happy Paws Studio',
  'Critter Creative',
  'BarkBox Media',
  'Hound House',
  'Pet Planet Group',
  'Zoologic Digital',
  'Woof & Co',
  'Pawsitive Brands',
  'PetPro Marketing',
  'Fur & Feather Co',
  'PawPrint Media',
];

/**
 * Generate events for one lead gen session.
 *
 * Funnel: page_view → form_start → form_field_focus(es) → form_complete → lead_qualify
 * Each step has a configurable drop-off rate.
 */
export function generateLeadgenSession(
  ctx: SessionContext,
  profile: LeadGenProfile,
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
  offsetMs += rng.int(3000, 15000);

  // 2. Scroll depth events
  const scrollDepths = [25, 50, 75, 100];
  for (const depth of scrollDepths) {
    if (!rng.chance(1 - depth / 200)) break; // Higher depths less likely
    events.push({
      ...createBaseEvent(ctx, 'scroll_depth', offsetMs),
      depth_percentage: depth,
      depth_pixels: depth * 15,
    } as SyntheticBaseEvent & { depth_percentage: number; depth_pixels: number });
    offsetMs += rng.int(2000, 8000);
  }

  // 3. Form start (gate)
  if (!rng.chance(profile.formStartRate)) {
    return events; // Browsed but didn't engage with form
  }

  const formStart: SyntheticBaseEvent = {
    ...createBaseEvent(ctx, 'form_start', offsetMs),
    event: 'form_start',
  };
  events.push(formStart);
  offsetMs += rng.int(1000, 3000);

  // 4. Form field interactions
  const fields = ['name', 'company', 'email', 'partnership_type', 'budget_range', 'message'];
  for (const field of fields) {
    events.push({
      ...createBaseEvent(ctx, 'form_field_focus', offsetMs),
      form_name: 'partnership_inquiry',
      field_name: field,
    } as SyntheticBaseEvent & { form_name: string; field_name: string });
    offsetMs += rng.int(3000, 15000);

    // Some users abandon mid-form
    if (field !== 'name' && rng.chance(0.05)) {
      return events; // Abandoned mid-form
    }
  }

  // 5. Form completion (gate)
  if (!rng.chance(profile.formCompletionRate)) {
    return events; // Started but didn't complete
  }

  const partnershipType = selectFromDistribution(
    profile.partnershipDistribution,
    rng,
  ) as PartnershipType;
  const budgetRange = selectFromDistribution(profile.budgetDistribution, rng) as BudgetRange;

  const formComplete: FormCompleteEvent = {
    ...createBaseEvent(ctx, 'form_complete', offsetMs),
    event: 'form_complete',
    form_name: 'partnership_inquiry',
    partnership_type: partnershipType,
    budget_range: budgetRange,
    company_name: rng.pick(COMPANY_NAMES),
  };
  events.push(formComplete);
  offsetMs += rng.int(500, 2000);

  // 6. Lead qualification (happens server-side, but we generate the event)
  if (!rng.chance(profile.qualificationRate)) {
    return events; // Submitted but not qualified
  }

  const qualificationTier = determineQualificationTier(budgetRange, partnershipType, rng);
  const leadId = `LEAD-${ctx.timestamp.getTime()}-${rng.int(1000, 9999)}`;

  const leadQualify: LeadQualifyEvent = {
    ...createBaseEvent(ctx, 'lead_qualify', offsetMs),
    event: 'lead_qualify',
    lead_id: leadId,
    qualification_tier: qualificationTier,
    partnership_type: partnershipType,
    budget_range: budgetRange,
  };
  events.push(leadQualify);

  return events;
}

/**
 * Select from a weighted distribution record.
 */
function selectFromDistribution<K extends string>(
  distribution: Record<K, number>,
  rng: SeededRandom,
): K {
  const entries = Object.entries(distribution) as Array<[K, number]>;
  const items: Array<readonly [K, number]> = entries.map(([key, weight]) => [
    key,
    weight as number,
  ]);
  return rng.weighted(items);
}

/**
 * Determine lead qualification tier based on budget and partnership type.
 */
function determineQualificationTier(
  budget: BudgetRange,
  partnership: PartnershipType,
  rng: SeededRandom,
): 'high' | 'medium' | 'low' {
  let score = 0;

  // Budget scoring
  switch (budget) {
    case '50k_plus':
      score += 3;
      break;
    case '15k_50k':
      score += 2;
      break;
    case '5k_15k':
      score += 1;
      break;
    case 'under_5k':
      score += 0;
      break;
    case 'prefer_to_discuss':
      score += 1;
      break;
  }

  // Partnership type scoring
  switch (partnership) {
    case 'licensing':
      score += 2;
      break;
    case 'product_collaboration':
      score += 2;
      break;
    case 'event_sponsorship':
      score += 1;
      break;
    case 'sponsored_content':
      score += 1;
      break;
    case 'not_sure':
      score += 0;
      break;
  }

  // Add some randomness
  score += rng.int(-1, 1);

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}
