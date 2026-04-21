/**
 * Timeline ring-buffer persistence (F8 user fix — "timeline is empty
 * upon reset").
 *
 * The `useDataLayerEvents` hook assembles `PipelineEvent` objects from
 * `window.dataLayer` on each poll tick. On a page refresh the dataLayer
 * is fresh-empty, so the Timeline tab renders empty even when the
 * visitor's session has real event history. This module persists a
 * bounded sliding window of the most recent events to sessionStorage
 * so the Timeline rehydrates across refreshes within the same tab.
 *
 * Scope: tab-lifetime (sessionStorage, not localStorage) — aligned
 * with the `SessionState` blob's semantics. A new tab starts fresh.
 *
 * Buffer cap matches the hook's default `maxBufferSize = 100`. Writes
 * are per-poll-tick; storage quota impact is bounded at ≈200 KB worst-
 * case (100 events × ~2 KB avg).
 */
import type { PipelineEvent } from './pipeline-schema';

export const TIMELINE_BUFFER_STORAGE_KEY = 'iampatterson.timeline_buffer';
const MAX_PERSIST_COUNT = 100;

function isPipelineEventShape(value: unknown): value is PipelineEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<PipelineEvent>;
  return (
    typeof v.pipeline_id === 'string' &&
    typeof v.event_name === 'string' &&
    typeof v.timestamp === 'string' &&
    typeof v.page_path === 'string' &&
    Array.isArray(v.routing)
  );
}

export function loadTimelineBuffer(): PipelineEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(TIMELINE_BUFFER_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPipelineEventShape).slice(0, MAX_PERSIST_COUNT);
  } catch {
    return [];
  }
}

export function saveTimelineBuffer(events: readonly PipelineEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    const capped = events.slice(0, MAX_PERSIST_COUNT);
    window.sessionStorage.setItem(TIMELINE_BUFFER_STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Quota / SecurityError — drop the write silently.
  }
}
