/**
 * Pure reducer and initializer for `SessionState`.
 *
 * The reducer applies one dataLayer event at a time and returns the next
 * state. It is deliberately side-effect-free so the provider can own
 * persistence, debug tooling can replay an event log, and tests can assert
 * invariants without renderer or sessionStorage wiring.
 *
 * Derive-from-schema rule (Phase 9E deliverable 4): `event_type_coverage.total`
 * reads `DATA_LAYER_EVENT_NAMES` once at module init, no hardcoded `16` or
 * `22` magic number anywhere in this file.
 */
import { DATA_LAYER_EVENT_NAMES, type DataLayerEventName } from '@/lib/events/schema';

import {
  COVERAGE_MILESTONE_THRESHOLDS,
  type ConsentValue,
  type CoverageMilestoneThreshold,
  type EcommerceStage,
  type SessionState,
} from './types';

/**
 * Frozen snapshot of the schema's event name list at module init. Exported so
 * the provider can reuse the same predicate set rather than rebuilding a
 * parallel one (derive-from-schema rule applies to both consumers).
 */
export const EVENT_NAME_SET: ReadonlySet<string> = new Set<string>(DATA_LAYER_EVENT_NAMES);

/** Runtime type guard: is this string one of the schema's known event names? */
export function isKnownEventName(name: string): name is DataLayerEventName {
  return EVENT_NAME_SET.has(name);
}

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

/** Optional overrides for the freshly-created state. */
export interface InitialSessionStateOverrides {
  /**
   * Seed `consent_snapshot` from an authoritative source (e.g. Cookiebot via
   * `getCurrentConsent()` in `src/lib/events/track.ts`). Without this, the
   * snapshot defaults to all-denied until the first event supplies otherwise.
   */
  consent?: {
    consent_analytics: boolean;
    consent_marketing: boolean;
    consent_preferences: boolean;
  };
}

function toConsentValue(granted: boolean): ConsentValue {
  return granted ? 'granted' : 'denied';
}

export function createInitialSessionState(
  sessionId: string,
  now: Date,
  overrides: InitialSessionStateOverrides = {},
): SessionState {
  const iso = now.toISOString();
  const consent = overrides.consent;
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
      analytics: toConsentValue(consent?.consent_analytics ?? false),
      marketing: toConsentValue(consent?.consent_marketing ?? false),
      preferences: toConsentValue(consent?.consent_preferences ?? false),
    },
    coverage_milestones_fired: [],
    updated_at: iso,
  };
}

/**
 * Given a coverage ratio (0..1) and the already-fired thresholds, return the
 * thresholds newly crossed. Pure function; used inside `deriveNext` and
 * available to tests / debug tooling in isolation.
 */
export function newlyCrossedMilestones(
  coverageRatio: number,
  alreadyFired: readonly CoverageMilestoneThreshold[],
): CoverageMilestoneThreshold[] {
  const percentage = coverageRatio * 100;
  return COVERAGE_MILESTONE_THRESHOLDS.filter((t) => percentage >= t && !alreadyFired.includes(t));
}

/**
 * Reconcile a rehydrated state blob against the current runtime schema.
 *
 * `event_type_coverage.total` is derived from `DATA_LAYER_EVENT_NAMES` at
 * module init, the derive-from-schema rule applies at every boundary, not
 * just fresh-session init. If a tab was open when a deploy extended the
 * schema, the persisted `total` is stale; reconciliation replaces it with
 * the live schema. `session_id` is reconciled against the current
 * `_iap_sid` cookie (which rotates after 30 minutes of idle) so the
 * in-blob ID matches what sGTM sees on subsequent events.
 */
export function reconcileRehydrated(loaded: SessionState, currentSessionId: string): SessionState {
  const liveTotal: DataLayerEventName[] = [...DATA_LAYER_EVENT_NAMES];
  const totalInSync =
    loaded.event_type_coverage.total.length === liveTotal.length &&
    loaded.event_type_coverage.total.every((name) => EVENT_NAME_SET.has(name));
  const sessionIdInSync = loaded.session_id === currentSessionId;

  if (totalInSync && sessionIdInSync) return loaded;

  const filteredEventsFired: Partial<Record<DataLayerEventName, number>> = {};
  for (const [name, count] of Object.entries(loaded.events_fired)) {
    if (isKnownEventName(name)) filteredEventsFired[name] = count;
  }

  return {
    ...loaded,
    session_id: currentSessionId,
    events_fired: filteredEventsFired,
    event_type_coverage: {
      fired: loaded.event_type_coverage.fired.filter((name) => EVENT_NAME_SET.has(name)),
      total: liveTotal,
    },
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

  const coverageRatio = coverageFired.length / state.event_type_coverage.total.length;
  const newMilestones = newlyCrossedMilestones(coverageRatio, state.coverage_milestones_fired);
  const coverage_milestones_fired =
    newMilestones.length > 0
      ? [...state.coverage_milestones_fired, ...newMilestones]
      : state.coverage_milestones_fired;

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
      analytics: toConsentValue(event.consent_analytics),
      marketing: toConsentValue(event.consent_marketing),
      preferences: toConsentValue(event.consent_preferences),
    },
    coverage_milestones_fired,
    updated_at: event.timestamp,
  };
}
