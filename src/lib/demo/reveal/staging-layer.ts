/**
 * Staging-layer shape for Phase 9F product-detail `LiveSidebar` (D6).
 *
 * Mirrors `docs/input_artifacts/design_handoff_ecommerce/app/data.js`'s
 * STAGING_TRANSFORM. Pre-9E `StagingLayerUnderside` salvage destination.
 *
 * Two content sets:
 * - `STAGING_FIELD_CASTS` — 6-row raw → typed cast table shown under the
 *   "01 · raw → typed cast" step. `product_id` / `product_price` substitute
 *   with the current visitor's product via `stagingRowsForProduct()`.
 * - `STAGING_STITCH_OPS` — 4-line `[OK]` checklist of staging operations
 *   shown under the "02 · stitch & enrich" step.
 */

export interface FieldCast {
  k: string;
  raw: string;
  typed: string;
  cast: string;
}

export interface StitchOp {
  op: string;
  status: 'OK' | 'WARN' | 'ERR';
  detail: string;
}

export const STAGING_FIELD_CASTS: FieldCast[] = [
  {
    k: 'event_name',
    raw: '"product_view"',
    typed: '"product_view"',
    cast: 'STRING',
  },
  {
    k: 'event_timestamp',
    raw: '"2026-04-20T14:32:08"',
    typed: 'TIMESTAMP(...)',
    cast: 'STRING → TIMESTAMP',
  },
  {
    k: 'session_id',
    raw: '"ses_x9b2…"',
    typed: '"ses_x9b2…"',
    cast: 'STRING',
  },
  {
    k: 'product_id',
    raw: '"tuna-plush-classic"',
    typed: '"tuna-plush-classic"',
    cast: 'STRING',
  },
  {
    k: 'product_price',
    raw: '"26.00"',
    typed: '26.00',
    cast: 'STRING → FLOAT64',
  },
  {
    k: 'page_path',
    raw: '"/demo/ecommerce/..."',
    typed: '"/demo/ecommerce/..."',
    cast: 'STRING',
  },
];

export const STAGING_STITCH_OPS: StitchOp[] = [
  { op: 'dedupe', status: 'OK', detail: 'no duplicate event_id in 60s window' },
  { op: 'session_stitch', status: 'OK', detail: 'linked to ses_x9b2… (14 events)' },
  { op: 'param_extract', status: 'OK', detail: '12 params hoisted to columns' },
  { op: 'geo_enrich', status: 'OK', detail: 'ip → country · region · city (geoip)' },
];

/**
 * Substitute `product_id` + `product_price` rows with the visitor's current
 * product so the readout is specific to what they're looking at. When
 * live-session context is available (visitor's actual session_id +
 * timestamp of the product_view event that just fired), those values also
 * substitute in place of the static seeds so the row reflects the real
 * event, not a placeholder.
 */
export function stagingRowsForProduct(
  product: { id: string; price: number },
  live?: {
    session_id?: string;
    last_event_at?: string;
  },
): FieldCast[] {
  const sid = live?.session_id && live.session_id.length > 0 ? live.session_id : null;
  const ts = live?.last_event_at && live.last_event_at.length > 0 ? live.last_event_at : null;

  return STAGING_FIELD_CASTS.map((f) => {
    if (f.k === 'product_id') {
      return { ...f, raw: `"${product.id}"`, typed: `"${product.id}"` };
    }
    if (f.k === 'product_price') {
      return { ...f, raw: `"${product.price}"`, typed: String(product.price) };
    }
    if (f.k === 'session_id' && sid) {
      // UUIDs are long; truncate like the prototype ("ses_x9b2…").
      const display = `"${sid.slice(0, 8)}…"`;
      return { ...f, raw: display, typed: display };
    }
    if (f.k === 'event_timestamp' && ts) {
      return { ...f, raw: `"${ts}"`, typed: 'TIMESTAMP(...)' };
    }
    return f;
  });
}

/**
 * Parameterise the stitch ops with live session facts — the pre-9F list
 * was entirely static (hardcoded event counts, session ids). When live
 * context is present, the `session_stitch` detail shows the real session
 * and real event count; other ops stay static (dedupe + param_extract +
 * geo_enrich are descriptive of the staging model, not session-variable).
 */
export function stitchOpsForSession(live?: {
  session_id?: string;
  events_in_session?: number;
}): StitchOp[] {
  const sid = live?.session_id && live.session_id.length > 0 ? live.session_id : null;
  const count = live?.events_in_session ?? 0;

  return STAGING_STITCH_OPS.map((o) => {
    // Only rewrite the session_stitch detail when we have BOTH a real
    // session_id AND at least one event — otherwise we'd emit
    // "linked to abc12345… (0 events)" which reads as a lie during the
    // window between cookie load and first event fire.
    if (o.op === 'session_stitch' && sid && count > 0) {
      const display = sid.slice(0, 8);
      return { ...o, detail: `linked to ${display}… (${count} events)` };
    }
    return o;
  });
}
