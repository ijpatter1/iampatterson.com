/**
 * Coverage milestone detection — Phase 9E deliverable 3.
 *
 * The reducer monotonically memoizes thresholds the visitor has crossed
 * (25/50/75/100 of `fired.length / total.length`). The memoization lives
 * in `SessionState.coverage_milestones_fired` so a tab reload mid-session
 * doesn't cause 50% to re-fire when the visitor re-crosses it. The
 * provider is responsible for emitting the dataLayer event when new
 * entries appear — this file tests the pure detection logic only.
 */
import { createInitialSessionState, deriveNext } from '@/lib/session-state/derive';
import type { SessionStateEventInput } from '@/lib/session-state/derive';
import { DATA_LAYER_EVENT_NAMES } from '@/lib/events/schema';

const INIT_NOW = new Date('2026-04-20T12:00:00.000Z');
const TOTAL = DATA_LAYER_EVENT_NAMES.length;

function makeEvent(
  name: string,
  over: Partial<SessionStateEventInput> = {},
): SessionStateEventInput {
  return {
    event: name as SessionStateEventInput['event'],
    timestamp: '2026-04-20T12:00:01.000Z',
    page_path: '/',
    consent_analytics: true,
    consent_marketing: false,
    consent_preferences: true,
    ...over,
  };
}

function fireDistinctEvents(
  initialState: ReturnType<typeof createInitialSessionState>,
  n: number,
  offset = 0,
) {
  let state = initialState;
  for (let i = 0; i < n; i++) {
    state = deriveNext(state, makeEvent(DATA_LAYER_EVENT_NAMES[offset + i]));
  }
  return state;
}

describe('coverage_milestones_fired — reducer detection', () => {
  it('starts empty on a fresh session', () => {
    const state = createInitialSessionState('sid', INIT_NOW);
    expect(state.coverage_milestones_fired).toEqual([]);
  });

  it('fires 25 when coverage crosses 25%', () => {
    const initial = createInitialSessionState('sid', INIT_NOW);
    // Need ceil(0.25 * 22) = 6 distinct event types to cross 25%.
    const needed = Math.ceil(0.25 * TOTAL);
    const state = fireDistinctEvents(initial, needed);
    expect(state.coverage_milestones_fired).toContain(25);
  });

  it('does not fire a higher threshold before reaching it', () => {
    const initial = createInitialSessionState('sid', INIT_NOW);
    const needed = Math.ceil(0.25 * TOTAL);
    const state = fireDistinctEvents(initial, needed);
    expect(state.coverage_milestones_fired).not.toContain(50);
    expect(state.coverage_milestones_fired).not.toContain(75);
    expect(state.coverage_milestones_fired).not.toContain(100);
  });

  it('accumulates thresholds monotonically as coverage grows', () => {
    const initial = createInitialSessionState('sid', INIT_NOW);
    const quarterCount = Math.ceil(0.25 * TOTAL);
    const halfCount = Math.ceil(0.5 * TOTAL);
    const quarter = fireDistinctEvents(initial, quarterCount);
    const half = fireDistinctEvents(quarter, halfCount - quarterCount, quarterCount);
    expect(half.coverage_milestones_fired).toEqual([25, 50]);
  });

  it('fires all four thresholds when coverage reaches 100%', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    for (const name of DATA_LAYER_EVENT_NAMES) {
      state = deriveNext(state, makeEvent(name));
    }
    expect(state.coverage_milestones_fired).toEqual([25, 50, 75, 100]);
  });

  it('does not duplicate a threshold when more events fire within the same band', () => {
    const initial = createInitialSessionState('sid', INIT_NOW);
    const past25 = fireDistinctEvents(initial, Math.ceil(0.25 * TOTAL));
    // Fire a same-name event again — coverage doesn't change, milestone array stable.
    const repeat = deriveNext(past25, makeEvent(DATA_LAYER_EVENT_NAMES[0]));
    expect(repeat.coverage_milestones_fired).toEqual(past25.coverage_milestones_fired);
  });
});
