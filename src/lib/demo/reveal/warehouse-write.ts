/**
 * BigQuery row preview for Phase 9F checkout `LiveSidebar` (D8).
 *
 * Mirrors the prototype's BQ_ROW_COLUMNS list — 21 representative columns
 * from the full ~51-column `iampatterson_raw.events_raw` schema (the subset
 * most relevant to checkout). Pre-9E `WarehouseWriteUnderside` salvage
 * destination.
 */

export interface BQColumn {
  k: string;
  v: string;
  type: 'STRING' | 'TIMESTAMP' | 'INT64' | 'FLOAT64' | 'ARRAY';
}

export const BQ_ROW_COLUMNS: BQColumn[] = [
  { k: 'event_name', v: '"begin_checkout"', type: 'STRING' },
  { k: 'event_timestamp', v: 'TIMESTAMP(...)', type: 'TIMESTAMP' },
  { k: 'received_timestamp', v: '1713536728942', type: 'INT64' },
  { k: 'session_id', v: '"ses_x9b2jk3q"', type: 'STRING' },
  { k: 'client_id', v: '"GA1.1.4821…"', type: 'STRING' },
  { k: 'user_pseudo_id', v: 'NULL', type: 'STRING' },
  { k: 'page_location', v: '".../checkout"', type: 'STRING' },
  { k: 'page_path', v: '"/demo/ecommerce/checkout"', type: 'STRING' },
  { k: 'page_referrer', v: '".../cart"', type: 'STRING' },
  { k: 'cart_value', v: '84.00', type: 'FLOAT64' },
  { k: 'cart_item_count', v: '3', type: 'INT64' },
  { k: 'currency', v: '"USD"', type: 'STRING' },
  { k: 'items', v: 'ARRAY<STRUCT>(3)', type: 'ARRAY' },
  { k: 'utm_source', v: '"meta"', type: 'STRING' },
  { k: 'utm_campaign', v: '"prospecting_lal_tuna_q1"', type: 'STRING' },
  { k: 'channel_classified', v: '"Meta · Prospecting"', type: 'STRING' },
  { k: 'consent_analytics', v: '"granted"', type: 'STRING' },
  { k: 'consent_marketing', v: '"denied"', type: 'STRING' },
  { k: 'geo_country', v: '"US"', type: 'STRING' },
  { k: 'device_category', v: '"desktop"', type: 'STRING' },
  { k: 'ingested_at', v: 'CURRENT_TIMESTAMP()', type: 'TIMESTAMP' },
];

/**
 * Substitute `cart_value` / `cart_item_count` / `items` rows with the
 * visitor's current cart state so the preview is specific.
 */
export function bqRowForCart(params: {
  total: number;
  itemCount: number;
  uniqueItems: number;
}): BQColumn[] {
  return BQ_ROW_COLUMNS.map((c) => {
    if (c.k === 'cart_value') return { ...c, v: params.total.toFixed(2) };
    if (c.k === 'cart_item_count') return { ...c, v: String(params.itemCount) };
    if (c.k === 'items') return { ...c, v: `ARRAY<STRUCT>(${params.uniqueItems})` };
    return c;
  });
}

/** 7-line pipeline-journey sequence for the full-page diagnostic moment. */
export const FULL_PAGE_DIAGNOSTIC_LINES: Array<{
  text: string;
  tag?: string;
  emph?: boolean;
}> = [
  { text: 'purchase event fired', tag: 'OK' },
  { text: 'consent check · analytics=granted, marketing=denied', tag: 'OK' },
  { text: 'routed → sGTM (io.iampatterson.com)', tag: 'OK' },
  { text: 'routed → Meta CAPI · skipped (marketing denied)', tag: 'SKIP' },
  { text: 'routed → BigQuery · 1 row written to iampatterson_raw.events_raw', tag: 'OK' },
  { text: 'attribution engine · last-click + shapley triggered', tag: 'OK' },
  { text: 'dashboards · revenue KPI refreshing', tag: 'LIVE', emph: true },
];
