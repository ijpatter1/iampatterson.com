/**
 * Ride-along payload shape for the optional contact-form `session_state`
 * field (Phase 9E deliverable 8; deferred by default in 9E).
 *
 * This helper is the authoritative contract for what leaves the browser if
 * the visitor opts into ride-along, a **narrow projection** of `SessionState`
 * that excludes fields like `visited_paths` which would leak in-tab URL
 * history. Any future surface that transmits session state across a
 * network boundary must go through this helper, not `JSON.stringify` the
 * whole blob.
 *
 * Shape matches `docs/UX_PIVOT_SPEC.md` §3.6 verbatim.
 */
import { RENDERABLE_EVENT_NAMES } from '@/lib/events/schema';

import type { ConsentValue, SessionState } from './types';

export interface RideAlongPayload {
  session_id: string;
  event_types_triggered: number;
  event_types_total: number;
  ecommerce_demo_percentage: number;
  pages_visited: number;
  consent: {
    analytics: ConsentValue;
    marketing: ConsentValue;
    preferences: ConsentValue;
  };
}

/**
 * Project SessionState to the ride-along contract. UAT F8 eval fix:
 * both `event_types_triggered` and `event_types_total` are computed
 * against `RENDERABLE_EVENT_NAMES` (not the full schema) so the
 * numbers transmitted match what the visitor saw on the Overview tab.
 *
 * Pre-F8 the payload transmitted `state.event_type_coverage.total.length`
 * (seeded from `DATA_LAYER_EVENT_NAMES`), while the Overview tab
 * rendered against `RENDERABLE_EVENT_NAMES` (the smaller subset minus
 * un-triggerable sub/leadgen events). A visitor who saw e.g.
 * "14 of 20 event types" on screen would have transmitted
 * `{event_types_triggered: 14, event_types_total:
 * DATA_LAYER_EVENT_NAMES.length}`, a surface-vs-transmission mismatch
 * flagged by F8 product + tech eval.
 */
export function toRideAlongPayload(state: SessionState): RideAlongPayload {
  const renderable = new Set<string>(RENDERABLE_EVENT_NAMES);
  const firedRenderable = state.event_type_coverage.fired.filter((n) => renderable.has(n));
  return {
    session_id: state.session_id,
    event_types_triggered: firedRenderable.length,
    event_types_total: RENDERABLE_EVENT_NAMES.length,
    ecommerce_demo_percentage: state.demo_progress.ecommerce.percentage,
    pages_visited: state.page_count,
    consent: { ...state.consent_snapshot },
  };
}
