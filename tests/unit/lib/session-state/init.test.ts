/**
 * Initial SessionState shape, derive-from-schema invariant.
 *
 * The `event_type_coverage.total` denominator is the single source of
 * truth for Session State gamification. It must derive at module init
 * from `DATA_LAYER_EVENT_NAMES` (the compile-time-guarded source of
 * truth), never from a hardcoded `16` or `22` constant. This file is the
 * regression guard for that rule (Phase 9E deliverable 4).
 */
import { DATA_LAYER_EVENT_NAMES } from '@/lib/events/schema';
import { createInitialSessionState } from '@/lib/session-state/derive';

const FIXED_NOW = new Date('2026-04-19T18:00:00.000Z');

describe('createInitialSessionState', () => {
  it('derives coverage total from DATA_LAYER_EVENT_NAMES (no hardcoded count)', () => {
    const state = createInitialSessionState('sid-abc', FIXED_NOW);
    expect(state.event_type_coverage.total).toHaveLength(DATA_LAYER_EVENT_NAMES.length);
    expect(new Set(state.event_type_coverage.total)).toEqual(new Set(DATA_LAYER_EVENT_NAMES));
  });

  it('starts with no events fired and empty coverage', () => {
    const state = createInitialSessionState('sid-abc', FIXED_NOW);
    expect(state.events_fired).toEqual({});
    expect(state.event_type_coverage.fired).toEqual([]);
  });

  it('captures session_id and started_at / updated_at from inputs', () => {
    const state = createInitialSessionState('sid-xyz', FIXED_NOW);
    expect(state.session_id).toBe('sid-xyz');
    expect(state.started_at).toBe(FIXED_NOW.toISOString());
    expect(state.updated_at).toBe(FIXED_NOW.toISOString());
  });

  it('starts with no ecommerce demo progress', () => {
    const state = createInitialSessionState('sid-abc', FIXED_NOW);
    expect(state.demo_progress.ecommerce.stages_reached).toEqual([]);
    expect(state.demo_progress.ecommerce.percentage).toBe(0);
  });

  it('starts with all consent signals denied until the first event supplies them', () => {
    const state = createInitialSessionState('sid-abc', FIXED_NOW);
    expect(state.consent_snapshot).toEqual({
      analytics: 'denied',
      marketing: 'denied',
      preferences: 'denied',
    });
  });

  it('seeds consent_snapshot from the optional overrides (e.g. getCurrentConsent from Cookiebot)', () => {
    const state = createInitialSessionState('sid-abc', FIXED_NOW, {
      consent: {
        consent_analytics: true,
        consent_marketing: false,
        consent_preferences: true,
      },
    });
    expect(state.consent_snapshot).toEqual({
      analytics: 'granted',
      marketing: 'denied',
      preferences: 'granted',
    });
  });

  it('starts with page_count = 0 and no visited paths', () => {
    const state = createInitialSessionState('sid-abc', FIXED_NOW);
    expect(state.page_count).toBe(0);
    expect(state.visited_paths).toEqual([]);
  });

  it('starts with no coverage milestones memoized (Pass 1 m4)', () => {
    const state = createInitialSessionState('sid-abc', FIXED_NOW);
    expect(state.coverage_milestones_fired).toEqual([]);
  });
});
