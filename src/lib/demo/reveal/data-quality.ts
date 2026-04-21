/**
 * Dataform data-quality assertion shape for Phase 9F cart `LiveSidebar` (D7).
 *
 * Mirrors the prototype's DATA_QUALITY_ASSERTIONS list. Pre-9E
 * `DataQualityUnderside` salvage destination.
 */

export interface Assertion {
  k: string;
  status: 'OK' | 'FAIL';
  detail: string;
}

export const DATA_QUALITY_ASSERTIONS: Assertion[] = [
  {
    k: 'schema_validation',
    status: 'OK',
    detail: 'all required fields present, types match',
  },
  {
    k: 'null_check',
    status: 'OK',
    detail: 'no nulls in non-nullable columns',
  },
  {
    k: 'volume_anomaly',
    status: 'OK',
    detail: '3 add_to_cart in 90s, within expected range',
  },
  {
    k: 'session_join_integrity',
    status: 'OK',
    detail: 'session_id matches active session row',
  },
  {
    k: 'freshness',
    status: 'OK',
    detail: 'last raw event 2.1s ago',
  },
  {
    k: 'referential_integrity',
    status: 'OK',
    detail: 'product_id exists in dim_products',
  },
];

/** Volume-anomaly threshold matching the prototype's "within expected range" copy. */
const VOLUME_ANOMALY_THRESHOLD = 10;

export interface LiveCartContext {
  /** Current cart item count. */
  itemCount: number;
  /** Real add_to_cart event count in the last 30s — feeds volume_anomaly. */
  addToCartInLast30s?: number;
  /** Real session_id — feeds session_join_integrity. */
  sessionId?: string;
  /** Seconds since the latest event landed — feeds freshness. */
  secondsSinceLastEvent?: number;
  /** Most recent event name (any event). Blank when no events have flowed yet. */
  lastEventName?: string;
}

/**
 * Per-visit assertion evaluation. The 6-row shape stays constant (the
 * message is "this is what Dataform asserts against every ingested row");
 * the detail text substitutes live values per assertion when context is
 * present, falling back to seed copy otherwise.
 *
 * - volume_anomaly: counts real add_to_cart events in the visitor's stream
 *   (last 30s). Cart itemCount is still used as the fallback signal so
 *   the assertion still reacts when there are no live events yet.
 * - session_join_integrity: names the real session_id.
 * - freshness: shows the real seconds-since-last-event, or a muted
 *   "no events yet" when the stream is empty.
 *
 * schema_validation / null_check / referential_integrity stay as seed
 * copy — they describe the assertion itself, not a session value.
 */
export function assertionsForCart(params: LiveCartContext): Assertion[] {
  const liveCount = params.addToCartInLast30s;
  const volumeCount = typeof liveCount === 'number' ? liveCount : params.itemCount;
  const sid = params.sessionId && params.sessionId.length > 0 ? params.sessionId : null;
  const secondsSince = params.secondsSinceLastEvent;
  const lastEvent =
    params.lastEventName && params.lastEventName.length > 0 ? params.lastEventName : null;

  return DATA_QUALITY_ASSERTIONS.map((a) => {
    if (a.k === 'volume_anomaly') {
      if (volumeCount > VOLUME_ANOMALY_THRESHOLD) {
        return {
          ...a,
          status: 'FAIL' as const,
          detail: `${volumeCount} add_to_cart events in 30s exceeds expected range`,
        };
      }
      if (typeof liveCount === 'number') {
        return { ...a, detail: `${liveCount} add_to_cart in 30s, within expected range` };
      }
      return a;
    }
    if (a.k === 'session_join_integrity' && sid) {
      return { ...a, detail: `session_id = ${sid.slice(0, 8)}… joined to active session` };
    }
    if (a.k === 'freshness') {
      if (typeof secondsSince === 'number' && lastEvent) {
        return { ...a, detail: `last ${lastEvent} ${secondsSince}s ago` };
      }
      if (typeof secondsSince === 'number') {
        return { ...a, detail: `last raw event ${secondsSince}s ago` };
      }
      return a;
    }
    return a;
  });
}
