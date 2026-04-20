/**
 * Rehydration reconciliation — the derive-from-schema rule applies at every
 * boundary. A persisted blob whose `event_type_coverage.total` predates a
 * schema extension must be swapped for the live schema on load, not left
 * stale. A stale `session_id` (sessionStorage survives the tab; the
 * `_iap_sid` cookie rotates every 30 min of idle) must be reconciled so
 * subsequent events flow under a consistent identifier.
 *
 * Phase 9E deliverable 4, Pass 1 evaluator findings I1 + I2.
 */
import { DATA_LAYER_EVENT_NAMES } from '@/lib/events/schema';
import { createInitialSessionState, reconcileRehydrated } from '@/lib/session-state/derive';
import type { SessionState } from '@/lib/session-state/types';

const INIT_NOW = new Date('2026-04-19T18:00:00.000Z');

describe('reconcileRehydrated', () => {
  it('returns the loaded state unchanged when total and session_id are already current', () => {
    const loaded = createInitialSessionState('sid', INIT_NOW);
    const result = reconcileRehydrated(loaded, 'sid');
    expect(result).toBe(loaded);
  });

  it('replaces a stale (pre-deploy) total with the live schema array', () => {
    const loaded = createInitialSessionState('sid', INIT_NOW);
    const stale: SessionState = {
      ...loaded,
      event_type_coverage: {
        fired: [],
        total: [
          'page_view',
          'click_cta',
        ] as unknown as SessionState['event_type_coverage']['total'],
      },
    };
    const result = reconcileRehydrated(stale, 'sid');
    expect(result.event_type_coverage.total).toEqual([...DATA_LAYER_EVENT_NAMES]);
  });

  it('updates session_id to the current cookie value on mismatch', () => {
    const loaded = createInitialSessionState('old-session-id', INIT_NOW);
    const result = reconcileRehydrated(loaded, 'fresh-session-id');
    expect(result.session_id).toBe('fresh-session-id');
  });

  it('filters coverage.fired to drop event names no longer in the schema', () => {
    const loaded = createInitialSessionState('sid', INIT_NOW);
    const withRemovedEvent = {
      ...loaded,
      event_type_coverage: {
        fired: [
          'page_view',
          'removed_event_from_a_prior_deploy',
          'click_cta',
        ] as unknown as SessionState['event_type_coverage']['fired'],
        total: [
          'page_view',
          'removed_event_from_a_prior_deploy',
          'click_cta',
        ] as unknown as SessionState['event_type_coverage']['total'],
      },
    };
    const result = reconcileRehydrated(withRemovedEvent, 'sid');
    expect(result.event_type_coverage.fired).toEqual(['page_view', 'click_cta']);
    expect(result.event_type_coverage.total).toEqual([...DATA_LAYER_EVENT_NAMES]);
  });

  it('filters events_fired keys to drop event names no longer in the schema (Pass 2 I1)', () => {
    const loaded = createInitialSessionState('sid', INIT_NOW);
    const withRemovedEventCount = {
      ...loaded,
      events_fired: {
        page_view: 5,
        removed_event_from_a_prior_deploy: 3,
        click_cta: 2,
      } as unknown as SessionState['events_fired'],
      event_type_coverage: {
        fired: [
          'page_view',
          'removed_event_from_a_prior_deploy',
          'click_cta',
        ] as unknown as SessionState['event_type_coverage']['fired'],
        total: [
          'page_view',
          'removed_event_from_a_prior_deploy',
          'click_cta',
        ] as unknown as SessionState['event_type_coverage']['total'],
      },
    };
    const result = reconcileRehydrated(withRemovedEventCount, 'sid');
    expect(result.events_fired).toEqual({ page_view: 5, click_cta: 2 });
    // The count map and the coverage.fired array stay in lockstep.
    expect(Object.keys(result.events_fired).sort()).toEqual(
      [...result.event_type_coverage.fired].sort(),
    );
  });

  it('reconciles when only the session_id is stale (total is already current)', () => {
    const loaded = createInitialSessionState('old-sid', INIT_NOW);
    const result = reconcileRehydrated(loaded, 'fresh-sid');
    expect(result.session_id).toBe('fresh-sid');
    // total was already [...DATA_LAYER_EVENT_NAMES] via createInitialSessionState.
    expect(result.event_type_coverage.total).toEqual([...DATA_LAYER_EVENT_NAMES]);
  });

  it('reconciles when only total is stale (session_id already matches)', () => {
    const loaded = createInitialSessionState('sid', INIT_NOW);
    const stale = {
      ...loaded,
      event_type_coverage: {
        fired: [] as unknown as SessionState['event_type_coverage']['fired'],
        total: ['page_view'] as unknown as SessionState['event_type_coverage']['total'],
      },
    };
    const result = reconcileRehydrated(stale, 'sid');
    expect(result.session_id).toBe('sid');
    expect(result.event_type_coverage.total).toEqual([...DATA_LAYER_EVENT_NAMES]);
  });

  it('preserves events_fired, demo_progress, visited_paths across reconciliation', () => {
    const loaded = createInitialSessionState('old-sid', INIT_NOW);
    const populated: SessionState = {
      ...loaded,
      events_fired: { page_view: 3, click_cta: 2 },
      visited_paths: ['/', '/services'],
      page_count: 2,
      demo_progress: {
        ecommerce: {
          stages_reached: ['product_view' as const, 'add_to_cart' as const],
          percentage: 50,
        },
      },
      // stale total — fired is a subset so the hasValidShape invariant holds.
      event_type_coverage: {
        fired: ['page_view'] as unknown as SessionState['event_type_coverage']['fired'],
        total: ['page_view'] as unknown as SessionState['event_type_coverage']['total'],
      },
    };
    const result = reconcileRehydrated(populated, 'fresh-sid');
    expect(result.events_fired).toEqual({ page_view: 3, click_cta: 2 });
    expect(result.visited_paths).toEqual(['/', '/services']);
    expect(result.page_count).toBe(2);
    expect(result.demo_progress.ecommerce.stages_reached).toEqual(['product_view', 'add_to_cart']);
    expect(result.demo_progress.ecommerce.percentage).toBe(50);
    expect(result.session_id).toBe('fresh-sid');
    expect(result.event_type_coverage.total).toEqual([...DATA_LAYER_EVENT_NAMES]);
  });
});
