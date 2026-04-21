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
  { op: 'geo_enrich', status: 'OK', detail: 'ip → US / CA / Los Angeles' },
];

/**
 * Substitute `product_id` + `product_price` rows with the visitor's current
 * product so the readout is specific to what they're looking at. Other
 * fields pass through unchanged.
 */
export function stagingRowsForProduct(product: { id: string; price: number }): FieldCast[] {
  return STAGING_FIELD_CASTS.map((f) => {
    if (f.k === 'product_id') {
      return { ...f, raw: `"${product.id}"`, typed: `"${product.id}"` };
    }
    if (f.k === 'product_price') {
      return { ...f, raw: `"${product.price}"`, typed: String(product.price) };
    }
    return f;
  });
}
