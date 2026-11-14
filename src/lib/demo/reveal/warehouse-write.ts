/**
 * BigQuery row preview for Phase 9F checkout `LiveSidebar` (D8).
 *
 * The purchase row the checkout form will write to
 * `iampatterson_raw.events_raw`: 16 representative columns. Every
 * event-specific column is one `trackPurchase` sends, and every column shown
 * exists in
 * `infrastructure/bigquery/schema.json` with the type shown, and the stated
 * table width is the schema's; tests/unit/lib/demo/reveal/warehouse-write.test.ts
 * pins both. Pre-9E `WarehouseWriteUnderside` salvage destination.
 *
 * 2026-11-14: `user_pseudo_id` was dropped (Ian's call; nothing forwards the
 * `_iap_aid` visitor ID to BigQuery yet). Four columns were renamed to the
 * table's names (`event_timestamp` → `timestamp`, `cart_value` →
 * `cart_total`, `cart_item_count` → `item_count`, `items` → `products`), five
 * the table does not have were dropped (`currency`, `channel_classified`,
 * `geo_country`, `device_category`, `ingested_at`), and the consent flags
 * show as BOOL, as stored. The row then became a true purchase row
 * (`event_name` 'purchase', `order_id` and `order_total` in place of
 * `cart_total`). `utm_source` and `utm_campaign` always show NULL, as a
 * real-site row stores them: nothing in the tag setup sends utm_* (measured
 * in BigQuery 2026-11-14; only the data generator fills them).
 * `page_referrer` shows NULL when the visitor has no referrer.
 */

export interface BQColumn {
  k: string;
  v: string;
  type: 'STRING' | 'INT64' | 'FLOAT64' | 'BOOL';
}

/**
 * Column count of `iampatterson_raw.events_raw`, from
 * `infrastructure/bigquery/schema.json`. A constant rather than an import so
 * the browser bundle does not carry the whole schema for one number; the
 * test above fails if it drifts from the schema.
 */
export const RAW_EVENTS_COLUMN_COUNT = 77;

/** Seed for `products`: the cart as JSON, as the purchase event sends it. */
const SEED_PRODUCTS =
  '[{"product_id":"tuna-plush-classic","product_name":"Tuna Plush","price":26,"quantity":1}]';

export const BQ_ROW_COLUMNS: BQColumn[] = [
  { k: 'event_name', v: '"purchase"', type: 'STRING' },
  { k: 'timestamp', v: '"2024-04-19T14:25:28.942Z"', type: 'STRING' },
  { k: 'received_timestamp', v: '1713536728942', type: 'INT64' },
  { k: 'session_id', v: '"ses_x9b2jk3q"', type: 'STRING' },
  { k: 'client_id', v: '"GA1.1.4821…"', type: 'STRING' },
  { k: 'page_location', v: '".../checkout"', type: 'STRING' },
  { k: 'page_path', v: '"/demo/ecommerce/checkout"', type: 'STRING' },
  { k: 'page_referrer', v: 'NULL', type: 'STRING' },
  { k: 'order_id', v: '"ORD-LX3K9Q2A"', type: 'STRING' },
  { k: 'order_total', v: '84.00', type: 'FLOAT64' },
  { k: 'item_count', v: '3', type: 'INT64' },
  { k: 'products', v: `"${SEED_PRODUCTS}"`, type: 'STRING' },
  { k: 'utm_source', v: 'NULL', type: 'STRING' },
  { k: 'utm_campaign', v: 'NULL', type: 'STRING' },
  { k: 'consent_analytics', v: 'true', type: 'BOOL' },
  { k: 'consent_marketing', v: 'false', type: 'BOOL' },
];

export interface LiveCheckoutContext {
  /** Real _iap_sid session id. */
  sessionId?: string;
  /** ISO timestamp of the most recent live event. */
  eventTimestamp?: string;
  /** Whether analytics consent has been granted in the real consent state. */
  consentAnalytics?: boolean;
  /** Whether marketing/ad-storage consent has been granted. */
  consentMarketing?: boolean;
  /** The visitor's actual page URL (window.location.href). */
  pageLocation?: string;
  /** document.referrer, honest about where the visitor came from. */
  pageReferrer?: string;
}

/**
 * Substitute `order_id` / `order_total` / `item_count` / `products` with the
 * order the form will submit, the same values `trackPurchase` sends, so the
 * preview is specific. `products` is the cart as JSON. When live session context is
 * supplied, also substitutes `session_id`, `timestamp`, `received_timestamp`,
 * and the two consent flags with the visitor's real values (UAT r1 items
 * 11 + 13).
 */
export function bqRowForCart(params: {
  total: number;
  itemCount: number;
  products: string;
  /** The order_id the form will submit. */
  orderId?: string;
  live?: LiveCheckoutContext;
}): BQColumn[] {
  const sid =
    params.live?.sessionId && params.live.sessionId.length > 0 ? params.live.sessionId : null;
  const ts =
    params.live?.eventTimestamp && params.live.eventTimestamp.length > 0
      ? params.live.eventTimestamp
      : null;
  const hasLiveConsent =
    params.live?.consentAnalytics !== undefined || params.live?.consentMarketing !== undefined;

  const pageLoc =
    params.live?.pageLocation && params.live.pageLocation.length > 0
      ? params.live.pageLocation
      : null;
  const pageRef =
    params.live?.pageReferrer && params.live.pageReferrer.length > 0
      ? params.live.pageReferrer
      : null;

  return BQ_ROW_COLUMNS.map((c) => {
    if (c.k === 'order_id' && params.orderId) return { ...c, v: `"${params.orderId}"` };
    if (c.k === 'order_total') return { ...c, v: params.total.toFixed(2) };
    if (c.k === 'item_count') return { ...c, v: String(params.itemCount) };
    if (c.k === 'products' && params.products) return { ...c, v: `"${params.products}"` };
    if (c.k === 'session_id' && sid) return { ...c, v: `"${sid.slice(0, 8)}…"` };
    if (c.k === 'timestamp' && ts) return { ...c, v: `"${ts}"` };
    if (c.k === 'received_timestamp' && ts) {
      const ms = Date.parse(ts);
      if (Number.isFinite(ms)) return { ...c, v: String(ms) };
    }
    if (c.k === 'consent_analytics' && hasLiveConsent) {
      return { ...c, v: String(params.live?.consentAnalytics === true) };
    }
    if (c.k === 'consent_marketing' && hasLiveConsent) {
      return { ...c, v: String(params.live?.consentMarketing === true) };
    }
    if (c.k === 'page_location' && pageLoc) return { ...c, v: `"${pageLoc}"` };
    if (c.k === 'page_referrer' && pageRef) return { ...c, v: `"${pageRef}"` };
    return c;
  });
}

/** 7-line pipeline-journey sequence for the full-page diagnostic moment.
 *
 * The static default assumes analytics=granted, marketing=denied, the
 * most common state for a visitor who accepts only strictly necessary
 * cookies via Cookiebot. Call `diagnosticLinesForConsent` to branch on
 * the visitor's real consent flags (UAT r1 item 14, honest data).
 */
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
  { text: 'dataform · marts rebuilding against the new row', tag: 'OK' },
  { text: 'dashboards · revenue KPI refreshing', tag: 'LIVE', emph: true },
];

/**
 * Build the 7-line pipeline-journey sequence against the visitor's real
 * consent state so the diagnostic text matches what would actually
 * happen. When analytics is denied, the consent check line reflects that;
 * when marketing is granted, the Meta CAPI line flips from SKIP to OK
 * ("routed → Meta CAPI · event sent"). Other lines are unconditional,
 * the purchase fires, sGTM receives it, BigQuery inserts the row, the
 * attribution engine and dashboards downstream of BQ both run.
 */
export function diagnosticLinesForConsent(consent: {
  analytics: boolean;
  marketing: boolean;
}): typeof FULL_PAGE_DIAGNOSTIC_LINES {
  const analyticsLabel = consent.analytics ? 'granted' : 'denied';
  const marketingLabel = consent.marketing ? 'granted' : 'denied';
  const metaLine = consent.marketing
    ? { text: 'routed → Meta CAPI · event sent (marketing granted)', tag: 'OK' }
    : { text: 'routed → Meta CAPI · skipped (marketing denied)', tag: 'SKIP' };

  return [
    { text: 'purchase event fired', tag: 'OK' },
    {
      text: `consent check · analytics=${analyticsLabel}, marketing=${marketingLabel}`,
      tag: 'OK',
    },
    { text: 'routed → sGTM (io.iampatterson.com)', tag: 'OK' },
    metaLine,
    { text: 'routed → BigQuery · 1 row written to iampatterson_raw.events_raw', tag: 'OK' },
    { text: 'dataform · marts rebuilding against the new row', tag: 'OK' },
    { text: 'dashboards · revenue KPI refreshing', tag: 'LIVE', emph: true },
  ];
}
