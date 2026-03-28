/**
 * HTTP transport — sends synthetic events to sGTM via /g/collect,
 * mimicking the exact format that gtag.js sends from the browser.
 *
 * The sGTM GA4 client expects hits at /g/collect with URL-encoded
 * query parameters (not JSON). This ensures events flow through
 * the same pipeline as real visitor events: sGTM GA4 client parses
 * them, then fires all tags (GA4, BigQuery, Pub/Sub).
 */

import type { SyntheticEvent, SyntheticBaseEvent } from './types';

export interface TransportConfig {
  /** sGTM endpoint URL (e.g., https://io.iampatterson.com). */
  sgtmUrl: string;
  /** GA4 Measurement ID (e.g., G-XXXXXXXXXX). */
  measurementId: string;
  /** Events per batch before inserting a delay. */
  batchSize: number;
  /** Delay between batches in ms (rate limiting). */
  batchDelayMs: number;
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  sgtmUrl: process.env['SGTM_URL'] || 'https://io.iampatterson.com',
  measurementId: process.env['GA4_MEASUREMENT_ID'] || 'G-9M2G3RLHWF',
  batchSize: 25,
  batchDelayMs: 100,
};

export interface SendResult {
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Send events to sGTM in batches via /g/collect.
 */
export async function sendEvents(
  events: SyntheticEvent[],
  config: TransportConfig,
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, errors: [] };

  const batches = chunkArray(events, config.batchSize);

  for (const batch of batches) {
    for (const event of batch) {
      try {
        await sendHit(event as SyntheticBaseEvent, config);
        result.sent++;
      } catch (err) {
        result.failed++;
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (config.batchDelayMs > 0) {
      await sleep(config.batchDelayMs);
    }
  }

  return result;
}

/**
 * Send a single event as a GA4 /g/collect hit.
 *
 * Sends a GET request to /g/collect with all parameters in the
 * query string — the same format gtag.js uses from the browser.
 */
async function sendHit(event: SyntheticBaseEvent, config: TransportConfig): Promise<void> {
  const base = config.sgtmUrl.replace(/\/$/, '');
  const params = buildCollectParams(event, config.measurementId);
  const url = `${base}/g/collect?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'iampatterson-data-generator/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`/g/collect failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Build URL-encoded parameters matching the GA4 /g/collect format.
 *
 * GA4 protocol uses these parameter prefixes:
 *   v     — protocol version (always 2)
 *   tid   — tracking/measurement ID
 *   cid   — client ID
 *   en    — event name
 *   dl    — document location (full URL)
 *   dt    — document title
 *   dr    — document referrer
 *   ep.*  — event parameter (string value)
 *   epn.* — event parameter (numeric value)
 *   _s    — hit sequence number
 *   _et   — engagement time in ms
 *   _ss   — session start flag
 *   sid   — GA4 session ID
 */
export function buildCollectParams(
  event: SyntheticBaseEvent,
  measurementId: string,
): URLSearchParams {
  const params = new URLSearchParams();

  // Protocol fields
  params.set('v', '2');
  params.set('tid', measurementId);
  params.set('cid', event.session_id);
  params.set('en', event.event);
  params.set('_s', '1');
  params.set('_et', '100');
  params.set('_ss', '1');
  params.set('sid', event.session_id);

  // Page context
  const pageLocation = `https://iampatterson-com.vercel.app${event.page_path}`;
  params.set('dl', pageLocation);
  params.set('dt', event.page_title);

  // Custom event parameters — use ep.* for strings, epn.* for numbers/booleans
  params.set('ep.iap_source', 'true');
  params.set('ep.session_id', event.session_id);
  params.set('ep.iap_session_id', event.iap_session_id);
  params.set('ep.page_path', event.page_path);

  // Consent state
  params.set('ep.consent_analytics', String(event.consent_analytics));
  params.set('ep.consent_marketing', String(event.consent_marketing));
  params.set('ep.consent_preferences', String(event.consent_preferences));

  // UTM parameters
  if (event.utm_source) params.set('ep.utm_source', event.utm_source);
  if (event.utm_medium) params.set('ep.utm_medium', event.utm_medium);
  if (event.utm_campaign) params.set('ep.utm_campaign', event.utm_campaign);

  // Extract custom parameters beyond the base event fields
  const baseKeys = new Set([
    'iap_source',
    'event',
    'timestamp',
    'session_id',
    'iap_session_id',
    'page_path',
    'page_title',
    'consent_analytics',
    'consent_marketing',
    'consent_preferences',
    'utm_source',
    'utm_medium',
    'utm_campaign',
  ]);

  for (const [key, value] of Object.entries(event)) {
    if (baseKeys.has(key) || value === undefined || value === null) continue;

    if (typeof value === 'number') {
      params.set(`epn.${key}`, String(value));
    } else if (typeof value === 'string') {
      params.set(`ep.${key}`, value);
    } else if (typeof value === 'boolean') {
      params.set(`ep.${key}`, String(value));
    } else if (typeof value === 'object') {
      // Serialize complex objects (e.g., products array in purchase events)
      params.set(`ep.${key}`, JSON.stringify(value));
    }
  }

  return params;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
