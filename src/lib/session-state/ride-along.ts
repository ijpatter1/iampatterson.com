/**
 * Ride-along payload shape for the optional contact-form `session_state`
 * field (Phase 9E deliverable 8; deferred by default in 9E).
 *
 * This helper is the authoritative contract for what leaves the browser if
 * the visitor opts into ride-along — a **narrow projection** of `SessionState`
 * that excludes fields like `visited_paths` which would leak in-tab URL
 * history. Any future surface that transmits session state across a
 * network boundary must go through this helper, not `JSON.stringify` the
 * whole blob.
 *
 * Shape matches `docs/UX_PIVOT_SPEC.md` §3.6 verbatim.
 */
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

export function toRideAlongPayload(state: SessionState): RideAlongPayload {
  return {
    session_id: state.session_id,
    event_types_triggered: state.event_type_coverage.fired.length,
    event_types_total: state.event_type_coverage.total.length,
    ecommerce_demo_percentage: state.demo_progress.ecommerce.percentage,
    pages_visited: state.page_count,
    consent: { ...state.consent_snapshot },
  };
}
