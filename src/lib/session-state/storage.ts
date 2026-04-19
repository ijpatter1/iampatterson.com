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

function hasValidShape(value: unknown): value is SessionState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SessionState>;
  return (
    typeof v.session_id === 'string' &&
    typeof v.started_at === 'string' &&
    typeof v.updated_at === 'string' &&
    typeof v.page_count === 'number' &&
    Array.isArray(v.visited_paths) &&
    typeof v.events_fired === 'object' &&
    v.events_fired !== null &&
    typeof v.event_type_coverage === 'object' &&
    v.event_type_coverage !== null &&
    Array.isArray(v.event_type_coverage.fired) &&
    Array.isArray(v.event_type_coverage.total) &&
    typeof v.demo_progress === 'object' &&
    v.demo_progress !== null &&
    typeof v.consent_snapshot === 'object' &&
    v.consent_snapshot !== null
  );
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
