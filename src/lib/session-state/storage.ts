/**
 * sessionStorage persistence for SessionState.
 *
 * Tab-scoped lifetime (returning visitors start fresh). Load tolerates
 * missing keys and malformed payloads — the provider falls back to a
 * freshly-initialized state. Save swallows quota / security errors; a
 * dropped save is preferable to an uncaught exception in the render path.
 */
import type { SessionState } from './types';

export const SESSION_STATE_STORAGE_KEY = 'iampatterson.session_state';

function isConsentValue(v: unknown): v is 'granted' | 'denied' {
  return v === 'granted' || v === 'denied';
}

/**
 * Structural validation of a persisted blob.
 *
 * Intentionally loose on event-name membership: the blob may contain event
 * names that predate a deploy's schema shape (or postdate one, if a rollback
 * happened). The authoritative repair is `reconcileRehydrated` in `derive.ts`
 * — this guard only rejects blobs that would crash the reducer outright.
 * It DOES enforce the invariant that every name in `fired` also appears in
 * `total`, so reconciliation never has to repair that particular breakage.
 */
function hasValidShape(value: unknown): value is SessionState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SessionState>;
  if (
    typeof v.session_id !== 'string' ||
    typeof v.started_at !== 'string' ||
    typeof v.updated_at !== 'string' ||
    typeof v.page_count !== 'number' ||
    !Array.isArray(v.visited_paths) ||
    typeof v.events_fired !== 'object' ||
    v.events_fired === null
  ) {
    return false;
  }
  if (
    typeof v.event_type_coverage !== 'object' ||
    v.event_type_coverage === null ||
    !Array.isArray(v.event_type_coverage.fired) ||
    !Array.isArray(v.event_type_coverage.total) ||
    !v.event_type_coverage.fired.every((n) => typeof n === 'string') ||
    !v.event_type_coverage.total.every((n) => typeof n === 'string')
  ) {
    return false;
  }
  const totalSet = new Set<string>(v.event_type_coverage.total);
  if (!v.event_type_coverage.fired.every((n) => totalSet.has(n))) {
    return false;
  }
  const dp = v.demo_progress;
  if (
    typeof dp !== 'object' ||
    dp === null ||
    typeof dp.ecommerce !== 'object' ||
    dp.ecommerce === null ||
    !Array.isArray(dp.ecommerce.stages_reached) ||
    typeof dp.ecommerce.percentage !== 'number'
  ) {
    return false;
  }
  const cs = v.consent_snapshot;
  if (
    typeof cs !== 'object' ||
    cs === null ||
    !isConsentValue(cs.analytics) ||
    !isConsentValue(cs.marketing) ||
    !isConsentValue(cs.preferences)
  ) {
    return false;
  }
  if (
    !Array.isArray(v.coverage_milestones_fired) ||
    !v.coverage_milestones_fired.every((t) => t === 25 || t === 50 || t === 75 || t === 100)
  ) {
    return false;
  }
  return true;
}

export function loadSessionState(): SessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return hasValidShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSessionState(state: SessionState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or SecurityError — drop the write silently.
  }
}
