/**
 * SessionState reducer — pure event-to-state derivation.
 *
 * Contract (Phase 9E deliverable 4, UX_PIVOT_SPEC §3.6):
 * - events_fired counts every applied event by name.
 * - event_type_coverage.fired is the set of distinct event names seen.
 * - demo_progress.ecommerce.stages_reached is monotonic (no un-reaching).
 * - consent_snapshot tracks the freshest boolean triple from any event.
 * - page_count counts distinct page_paths; repeated page_view on the same
 *   path does not advance it.
 */
import { createInitialSessionState, deriveNext } from '@/lib/session-state/derive';
import type { SessionStateEventInput } from '@/lib/session-state/derive';

const INIT_NOW = new Date('2026-04-19T18:00:00.000Z');

function makeEvent(overrides: Partial<SessionStateEventInput> = {}): SessionStateEventInput {
  return {
    event: 'page_view',
    timestamp: '2026-04-19T18:00:01.000Z',
    page_path: '/',
    consent_analytics: true,
    consent_marketing: false,
    consent_preferences: true,
    ...overrides,
  };
}

describe('deriveNext — event counts and coverage', () => {
  it('increments events_fired on each event', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'click_cta' }));
    state = deriveNext(state, makeEvent({ event: 'click_cta' }));
    state = deriveNext(state, makeEvent({ event: 'add_to_cart' }));
    expect(state.events_fired).toEqual({ click_cta: 2, add_to_cart: 1 });
  });

  it('adds each new event name to coverage.fired exactly once', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'click_cta' }));
    state = deriveNext(state, makeEvent({ event: 'click_cta' }));
    state = deriveNext(state, makeEvent({ event: 'add_to_cart' }));
    expect(state.event_type_coverage.fired).toEqual(['click_cta', 'add_to_cart']);
  });

  it('ignores unknown event names (defensive — provider filters, but reducer is safe)', () => {
    const initial = createInitialSessionState('sid', INIT_NOW);
    const next = deriveNext(
      initial,
      // intentionally pass a name not in DATA_LAYER_EVENT_NAMES
      makeEvent({ event: 'gtm.dom' as unknown as SessionStateEventInput['event'] }),
    );
    expect(next).toBe(initial);
  });

  it('updates updated_at from the event timestamp', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ timestamp: '2026-04-19T18:05:00.000Z' }));
    expect(state.updated_at).toBe('2026-04-19T18:05:00.000Z');
  });
});

describe('deriveNext — page_count (unique paths)', () => {
  it('increments page_count on the first page_view of a path', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'page_view', page_path: '/' }));
    expect(state.page_count).toBe(1);
    expect(state.visited_paths).toEqual(['/']);
  });

  it('does not increment page_count when the same path fires page_view again', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'page_view', page_path: '/services' }));
    state = deriveNext(state, makeEvent({ event: 'page_view', page_path: '/services' }));
    expect(state.page_count).toBe(1);
    expect(state.visited_paths).toEqual(['/services']);
  });

  it('counts distinct page paths independently', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'page_view', page_path: '/' }));
    state = deriveNext(state, makeEvent({ event: 'page_view', page_path: '/services' }));
    state = deriveNext(state, makeEvent({ event: 'page_view', page_path: '/about' }));
    expect(state.page_count).toBe(3);
    expect(state.visited_paths).toEqual(['/', '/services', '/about']);
  });

  it('non-page_view events do not touch page_count even if they carry a new page_path', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'click_cta', page_path: '/never-viewed' }));
    expect(state.page_count).toBe(0);
    expect(state.visited_paths).toEqual([]);
  });
});

describe('deriveNext — ecommerce demo progress (monotonic)', () => {
  it('adds a stage when its trigger event fires', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'product_view' }));
    expect(state.demo_progress.ecommerce.stages_reached).toEqual(['product_view']);
    expect(state.demo_progress.ecommerce.percentage).toBe(25);
  });

  it('accumulates stages across the funnel', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'product_view' }));
    state = deriveNext(state, makeEvent({ event: 'add_to_cart' }));
    state = deriveNext(state, makeEvent({ event: 'begin_checkout' }));
    state = deriveNext(state, makeEvent({ event: 'purchase' }));
    expect(state.demo_progress.ecommerce.stages_reached).toEqual([
      'product_view',
      'add_to_cart',
      'begin_checkout',
      'purchase',
    ]);
    expect(state.demo_progress.ecommerce.percentage).toBe(100);
  });

  it('does not duplicate a stage when its event fires twice', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'add_to_cart' }));
    state = deriveNext(state, makeEvent({ event: 'add_to_cart' }));
    expect(state.demo_progress.ecommerce.stages_reached).toEqual(['add_to_cart']);
    expect(state.demo_progress.ecommerce.percentage).toBe(25);
  });

  it('is monotonic — an earlier stage firing after a later one does not reorder or shrink', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'purchase' }));
    state = deriveNext(state, makeEvent({ event: 'product_view' }));
    // Both stages reached; purchase remains. Order by first-reached (purchase was first).
    expect(state.demo_progress.ecommerce.stages_reached).toEqual(['purchase', 'product_view']);
    expect(state.demo_progress.ecommerce.percentage).toBe(50);
  });

  it('non-funnel events do not advance demo progress', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, makeEvent({ event: 'click_cta' }));
    state = deriveNext(state, makeEvent({ event: 'scroll_depth' }));
    expect(state.demo_progress.ecommerce.stages_reached).toEqual([]);
    expect(state.demo_progress.ecommerce.percentage).toBe(0);
  });
});

describe('deriveNext — consent_snapshot', () => {
  it('updates consent snapshot from every event (not only consent_update)', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(
      state,
      makeEvent({
        event: 'page_view',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: false,
      }),
    );
    expect(state.consent_snapshot).toEqual({
      analytics: 'granted',
      marketing: 'granted',
      preferences: 'denied',
    });
  });

  it('consent_update events refresh the snapshot', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(
      state,
      makeEvent({
        event: 'consent_update',
        consent_analytics: false,
        consent_marketing: false,
        consent_preferences: false,
      }),
    );
    expect(state.consent_snapshot).toEqual({
      analytics: 'denied',
      marketing: 'denied',
      preferences: 'denied',
    });
  });
});
