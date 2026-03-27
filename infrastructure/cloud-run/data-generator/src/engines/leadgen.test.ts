import { generateLeadgenSession } from './leadgen';
import { createSessionContext } from '../session';
import { createLeadgenConfig } from '../profiles';
import { SeededRandom } from '../random';
import type {
  LeadGenProfile,
  FormCompleteEvent,
  LeadQualifyEvent,
  SyntheticBaseEvent,
} from '../types';

function makeSession(seed = 42) {
  const config = createLeadgenConfig({ seed });
  const rng = new SeededRandom(seed);
  const timestamp = new Date('2025-06-15T14:00:00Z');
  const ctx = createSessionContext(config, timestamp, rng);
  return { config, rng, ctx, profile: config.profile as LeadGenProfile };
}

describe('generateLeadgenSession', () => {
  it('always starts with a page_view event', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateLeadgenSession(ctx, profile, rng);
    expect(events[0].event).toBe('page_view');
  });

  it('all events share the same session_id', () => {
    const { ctx, profile, rng } = makeSession();
    const events = generateLeadgenSession(ctx, profile, rng);
    for (const event of events) {
      expect((event as SyntheticBaseEvent).session_id).toBe(ctx.sessionId);
    }
  });

  it('includes scroll_depth events', () => {
    // Run multiple sessions to find one with scroll events
    let found = false;
    for (let seed = 0; seed < 50; seed++) {
      const { ctx, profile, rng } = makeSession(seed);
      const events = generateLeadgenSession(ctx, profile, rng);
      if (events.some((e) => e.event === 'scroll_depth')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  describe('form funnel behavior', () => {
    function runManySessions(n: number) {
      const stats = {
        total: 0,
        withFormStart: 0,
        withFormComplete: 0,
        withLeadQualify: 0,
      };

      for (let seed = 0; seed < n; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateLeadgenSession(ctx, profile, rng);
        const eventNames = events.map((e) => e.event);

        stats.total++;
        if (eventNames.includes('form_start')) stats.withFormStart++;
        if (eventNames.includes('form_complete')) stats.withFormComplete++;
        if (eventNames.includes('lead_qualify')) stats.withLeadQualify++;
      }
      return stats;
    }

    it('funnel narrows at each step', () => {
      const stats = runManySessions(2000);
      expect(stats.withFormStart).toBeGreaterThan(stats.withFormComplete);
      expect(stats.withFormComplete).toBeGreaterThan(stats.withLeadQualify);
    });

    it('form start rate is roughly consistent with config', () => {
      const stats = runManySessions(2000);
      const rate = stats.withFormStart / stats.total;
      // Configured at 0.25
      expect(rate).toBeGreaterThan(0.15);
      expect(rate).toBeLessThan(0.35);
    });
  });

  describe('form_complete events', () => {
    it('have valid partnership type and budget range', () => {
      const validPartnershipTypes = [
        'sponsored_content',
        'product_collaboration',
        'event_sponsorship',
        'licensing',
        'not_sure',
      ];
      const validBudgetRanges = ['under_5k', '5k_15k', '15k_50k', '50k_plus', 'prefer_to_discuss'];

      let foundComplete = false;
      for (let seed = 0; seed < 300; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateLeadgenSession(ctx, profile, rng);
        const completes = events.filter((e) => e.event === 'form_complete') as FormCompleteEvent[];
        for (const fc of completes) {
          foundComplete = true;
          expect(validPartnershipTypes).toContain(fc.partnership_type);
          expect(validBudgetRanges).toContain(fc.budget_range);
          expect(fc.company_name).toBeTruthy();
          expect(fc.form_name).toBe('partnership_inquiry');
        }
      }
      expect(foundComplete).toBe(true);
    });
  });

  describe('lead_qualify events', () => {
    it('have valid qualification tiers', () => {
      let foundQualify = false;
      const tiers = new Set<string>();

      for (let seed = 0; seed < 500; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateLeadgenSession(ctx, profile, rng);
        const qualifies = events.filter((e) => e.event === 'lead_qualify') as LeadQualifyEvent[];
        for (const lq of qualifies) {
          foundQualify = true;
          expect(['high', 'medium', 'low']).toContain(lq.qualification_tier);
          expect(lq.lead_id).toMatch(/^LEAD-/);
          tiers.add(lq.qualification_tier);
        }
      }
      expect(foundQualify).toBe(true);
      // Over 500 sessions we should see multiple tier types
      expect(tiers.size).toBeGreaterThanOrEqual(2);
    });

    it('higher budgets tend to get higher qualification tiers', () => {
      const tiersByBudget: Record<string, string[]> = {};

      for (let seed = 0; seed < 1000; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateLeadgenSession(ctx, profile, rng);
        const qualifies = events.filter((e) => e.event === 'lead_qualify') as LeadQualifyEvent[];
        for (const lq of qualifies) {
          if (!tiersByBudget[lq.budget_range]) tiersByBudget[lq.budget_range] = [];
          tiersByBudget[lq.budget_range].push(lq.qualification_tier);
        }
      }

      // If we have enough data, high budgets should have more 'high' tiers
      if (tiersByBudget['50k_plus'] && tiersByBudget['under_5k']) {
        const highBudgetHighTier =
          tiersByBudget['50k_plus'].filter((t) => t === 'high').length /
          tiersByBudget['50k_plus'].length;
        const lowBudgetHighTier =
          tiersByBudget['under_5k'].filter((t) => t === 'high').length /
          tiersByBudget['under_5k'].length;
        expect(highBudgetHighTier).toBeGreaterThanOrEqual(lowBudgetHighTier);
      }
    });
  });

  describe('form field interactions', () => {
    it('generate form_field_focus events for sessions that start forms', () => {
      let foundFieldFocus = false;
      for (let seed = 0; seed < 100; seed++) {
        const { ctx, profile, rng } = makeSession(seed);
        const events = generateLeadgenSession(ctx, profile, rng);
        if (events.some((e) => e.event === 'form_start')) {
          const fieldFocusEvents = events.filter((e) => e.event === 'form_field_focus');
          if (fieldFocusEvents.length > 0) {
            foundFieldFocus = true;
            break;
          }
        }
      }
      expect(foundFieldFocus).toBe(true);
    });
  });
});
