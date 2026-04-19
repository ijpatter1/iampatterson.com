/**
 * Pure reducer and initializer for `SessionState`.
 *
 * The reducer applies one dataLayer event at a time and returns the next
 * state. It is deliberately side-effect-free so the provider can own
 * persistence, debug tooling can replay an event log, and tests can assert
 * invariants without renderer or sessionStorage wiring.
 *
 * Derive-from-schema rule (Phase 9E deliverable 4): `event_type_coverage.total`
 * reads `DATA_LAYER_EVENT_NAMES` once at module init — no hardcoded `16` or
 * `22` magic number anywhere in this file.
 */
import { DATA_LAYER_EVENT_NAMES, type DataLayerEventName } from '@/lib/events/schema';

import type { EcommerceStage, SessionState } from './types';

/** Frozen snapshot of the schema's event name list at module init. */
const EVENT_NAME_SET: ReadonlySet<DataLayerEventName> = new Set(DATA_LAYER_EVENT_NAMES);

/** Map of ecommerce-funnel event names → stage labels. */
const ECOMMERCE_STAGE_BY_EVENT: Partial<Record<DataLayerEventName, EcommerceStage>> = {
  product_view: 'product_view',
  add_to_cart: 'add_to_cart',
  begin_checkout: 'begin_checkout',
  purchase: 'purchase',
};

const STAGE_COUNT = 4;

/** Minimal subset of a data-layer event the reducer needs. */
export interface SessionStateEventInput {
  event: DataLayerEventName;
  timestamp: string;
  page_path: string;
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
}

export function createInitialSessionState(sessionId: string, now: Date): SessionState {
  const iso = now.toISOString();
  return {
    session_id: sessionId,
    started_at: iso,
    page_count: 0,
    visited_paths: [],
    events_fired: {},
    event_type_coverage: {
      fired: [],
      total: [...DATA_LAYER_EVENT_NAMES],
    },
    demo_progress: {
      ecommerce: {
        stages_reached: [],
        percentage: 0,
      },
    },
    consent_snapshot: {
      analytics: 'denied',
      marketing: 'denied',
      preferences: 'denied',
    },
    updated_at: iso,
  };
}

export function deriveNext(state: SessionState, event: SessionStateEventInput): SessionState {
  if (!EVENT_NAME_SET.has(event.event)) return state;

  const events_fired = {
    ...state.events_fired,
    [event.event]: (state.events_fired[event.event] ?? 0) + 1,
  };

  const firstOccurrence = state.events_fired[event.event] === undefined;
  const coverageFired = firstOccurrence
    ? [...state.event_type_coverage.fired, event.event]
    : state.event_type_coverage.fired;

  let { page_count, visited_paths } = state;
  if (event.event === 'page_view' && !visited_paths.includes(event.page_path)) {
    visited_paths = [...visited_paths, event.page_path];
    page_count = visited_paths.length;
  }

  let stages_reached = state.demo_progress.ecommerce.stages_reached;
  const stage = ECOMMERCE_STAGE_BY_EVENT[event.event];
  if (stage && !stages_reached.includes(stage)) {
    stages_reached = [...stages_reached, stage];
  }
  const percentage = Math.round((stages_reached.length / STAGE_COUNT) * 100);

  return {
    ...state,
    page_count,
    visited_paths,
    events_fired,
    event_type_coverage: {
      fired: coverageFired,
      total: state.event_type_coverage.total,
    },
    demo_progress: {
      ...state.demo_progress,
      ecommerce: {
        stages_reached,
        percentage,
      },
    },
    consent_snapshot: {
      analytics: event.consent_analytics ? 'granted' : 'denied',
      marketing: event.consent_marketing ? 'granted' : 'denied',
      preferences: event.consent_preferences ? 'granted' : 'denied',
    },
    updated_at: event.timestamp,
  };
}
