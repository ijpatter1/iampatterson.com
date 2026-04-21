/**
 * BigQuery row preview for Phase 9F checkout `LiveSidebar` (D8).
 *
 * Mirrors the prototype's BQ_ROW_COLUMNS list, 21 representative columns
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
  /** Resolved utm_campaign (either URL param or "" when absent). */
  utmCampaign?: string;
  /** Whether utmCampaign came from the visitor's URL (vs fallback seed). */
  utmIsLive?: boolean;
  /** Classified UTM source, Meta / Google / TikTok / Email / Unknown. */
  utmSource?: string;
  /** Classified channel bucket, Prospecting · Lookalike / Brand · Search / … */
  channelClassified?: string;
  /** Derived device category, "mobile" / "tablet" / "desktop". */
  deviceCategory?: string;
}

/**
 * Substitute `cart_value` / `cart_item_count` / `items` rows with the
 * visitor's current cart state so the preview is specific. When live
 * session context is supplied, also substitutes `session_id`,
 * `event_timestamp`, `received_timestamp`, and the two consent flags
 * with the visitor's real values (UAT r1 items 11 + 13).
 */
export function bqRowForCart(params: {
  total: number;
  itemCount: number;
  uniqueItems: number;
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
  // utm_* + channel_classified substitute only when the visitor's URL
  // actually carried a utm_campaign. Otherwise the seed stays and we
  // surface the "example" framing via the readout header (same honesty
  // pattern as the listing-hero UTM panel).
  const utmLive = params.live?.utmIsLive === true;

  return BQ_ROW_COLUMNS.map((c) => {
    if (c.k === 'cart_value') return { ...c, v: params.total.toFixed(2) };
    if (c.k === 'cart_item_count') return { ...c, v: String(params.itemCount) };
    if (c.k === 'items') return { ...c, v: `ARRAY<STRUCT>(${params.uniqueItems})` };
    if (c.k === 'session_id' && sid) return { ...c, v: `"${sid.slice(0, 8)}…"` };
    if (c.k === 'event_timestamp' && ts) return { ...c, v: `"${ts}"` };
    if (c.k === 'received_timestamp' && ts) {
      const ms = Date.parse(ts);
      if (Number.isFinite(ms)) return { ...c, v: String(ms) };
    }
    if (c.k === 'consent_analytics' && hasLiveConsent) {
      return { ...c, v: `"${params.live?.consentAnalytics ? 'granted' : 'denied'}"` };
    }
    if (c.k === 'consent_marketing' && hasLiveConsent) {
      return { ...c, v: `"${params.live?.consentMarketing ? 'granted' : 'denied'}"` };
    }
    if (c.k === 'page_location' && pageLoc) return { ...c, v: `"${pageLoc}"` };
    if (c.k === 'page_referrer' && pageRef) return { ...c, v: `"${pageRef}"` };
    if (c.k === 'utm_campaign' && utmLive && params.live?.utmCampaign) {
      return { ...c, v: `"${params.live.utmCampaign}"` };
    }
    if (c.k === 'utm_source' && utmLive && params.live?.utmSource) {
      return { ...c, v: `"${params.live.utmSource}"` };
    }
    if (c.k === 'channel_classified' && utmLive && params.live?.channelClassified) {
      return { ...c, v: `"${params.live.channelClassified}"` };
    }
    if (c.k === 'device_category' && params.live?.deviceCategory) {
      return { ...c, v: `"${params.live.deviceCategory}"` };
    }
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
