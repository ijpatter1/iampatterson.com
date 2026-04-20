/**
 * `toRideAlongPayload` projects `SessionState` onto the minimal shape the
 * contact-form ride-along transmits (UX_PIVOT_SPEC §3.6). The projection
 * deliberately excludes `visited_paths` — the spec transmits `pages_visited`
 * as a count, never a path history. This helper is the authoritative gate
 * against accidentally `JSON.stringify`-ing the whole blob into a form field.
 */
import { createInitialSessionState, deriveNext } from '@/lib/session-state/derive';
import { toRideAlongPayload } from '@/lib/session-state/ride-along';

const INIT_NOW = new Date('2026-04-19T18:00:00.000Z');

describe('toRideAlongPayload', () => {
  it('projects the spec payload shape from a fresh state', () => {
    const state = createInitialSessionState('sid-xyz', INIT_NOW);
    const payload = toRideAlongPayload(state);
    expect(payload).toEqual({
      session_id: 'sid-xyz',
      event_types_triggered: 0,
      event_types_total: state.event_type_coverage.total.length,
      ecommerce_demo_percentage: 0,
      pages_visited: 0,
      consent: { analytics: 'denied', marketing: 'denied', preferences: 'denied' },
    });
  });

  it('reflects counts from an evolved session state', () => {
    let state = createInitialSessionState('sid-xyz', INIT_NOW);
    state = deriveNext(state, {
      event: 'page_view',
      timestamp: '2026-04-19T18:00:01.000Z',
      page_path: '/',
      consent_analytics: true,
      consent_marketing: true,
      consent_preferences: false,
    });
    state = deriveNext(state, {
      event: 'product_view',
      timestamp: '2026-04-19T18:00:02.000Z',
      page_path: '/demo/ecommerce/sea-salt',
      consent_analytics: true,
      consent_marketing: true,
      consent_preferences: false,
    });
    state = deriveNext(state, {
      event: 'add_to_cart',
      timestamp: '2026-04-19T18:00:03.000Z',
      page_path: '/demo/ecommerce/sea-salt',
      consent_analytics: true,
      consent_marketing: true,
      consent_preferences: false,
    });

    const payload = toRideAlongPayload(state);
    expect(payload.event_types_triggered).toBe(3);
    expect(payload.ecommerce_demo_percentage).toBe(50);
    expect(payload.pages_visited).toBe(1);
    expect(payload.consent).toEqual({
      analytics: 'granted',
      marketing: 'granted',
      preferences: 'denied',
    });
  });

  it('does NOT expose visited_paths or events_fired — projection is narrow by design', () => {
    let state = createInitialSessionState('sid', INIT_NOW);
    state = deriveNext(state, {
      event: 'page_view',
      timestamp: '2026-04-19T18:00:01.000Z',
      page_path: '/services',
      consent_analytics: true,
      consent_marketing: false,
      consent_preferences: false,
    });
    const payload = toRideAlongPayload(state);
    expect(payload).not.toHaveProperty('visited_paths');
    expect(payload).not.toHaveProperty('events_fired');
    expect(payload).not.toHaveProperty('event_type_coverage');
  });

  it('returns a defensive copy of consent so later state mutation cannot alias in', () => {
    const state = createInitialSessionState('sid', INIT_NOW);
    const payload = toRideAlongPayload(state);
    expect(payload.consent).not.toBe(state.consent_snapshot);
  });
});
