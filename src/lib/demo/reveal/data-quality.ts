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

/**
 * Per-visit assertion evaluation. Most assertions are static seed messages;
 * volume_anomaly is parameterised against the visitor's actual cart state so
 * a visitor who stuffs 20 plushes into their cart sees the `[FAIL]` branch
 * with the honest "exceeds expected range" detail. Other assertions would
 * also be parameterisable in real deployment — kept static here to keep the
 * demo behaviour predictable for screenshots and tests.
 */
export function assertionsForCart(params: { itemCount: number }): Assertion[] {
  return DATA_QUALITY_ASSERTIONS.map((a) => {
    if (a.k === 'volume_anomaly' && params.itemCount > VOLUME_ANOMALY_THRESHOLD) {
      return {
        ...a,
        status: 'FAIL' as const,
        detail: `${params.itemCount} add_to_cart events in 30s exceeds expected range`,
      };
    }
    return a;
  });
}
