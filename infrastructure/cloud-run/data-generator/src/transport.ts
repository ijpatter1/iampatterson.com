/**
 * HTTP transport — sends synthetic events to sGTM via the
 * Measurement Protocol, simulating browser-to-GTM traffic.
 *
 * Events are sent as GA4 Measurement Protocol hits to the sGTM
 * endpoint, which processes them identically to real browser events.
 */

import type { SyntheticEvent, SyntheticBaseEvent } from './types';

export interface TransportConfig {
  /** sGTM endpoint URL (e.g., https://io.iampatterson.com). */
  sgtmUrl: string;
  /** GA4 Measurement ID (e.g., G-XXXXXXXXXX). */
  measurementId: string;
  /** GA4 API secret for server-side Measurement Protocol. */
  apiSecret: string;
  /** Max events per batch (Measurement Protocol limit is 25). */
  batchSize: number;
  /** Delay between batches in ms (rate limiting). */
  batchDelayMs: number;
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  sgtmUrl: process.env['SGTM_URL'] || 'https://io.iampatterson.com',
  measurementId: process.env['GA4_MEASUREMENT_ID'] || 'G-9M2G3RLHWF',
  apiSecret: process.env['GA4_API_SECRET'] || '',
  batchSize: 25,
  batchDelayMs: 100,
};

export interface SendResult {
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Send events to sGTM in batches via the Measurement Protocol.
 */
export async function sendEvents(
  events: SyntheticEvent[],
  config: TransportConfig,
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, errors: [] };

  const batches = chunkArray(events, config.batchSize);

  for (const batch of batches) {
    try {
      await sendBatch(batch, config);
      result.sent += batch.length;
    } catch (err) {
      result.failed += batch.length;
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    if (config.batchDelayMs > 0) {
      await sleep(config.batchDelayMs);
    }
  }

  return result;
}

/**
 * Send a batch of events via the Measurement Protocol.
 */
async function sendBatch(events: SyntheticEvent[], config: TransportConfig): Promise<void> {
  const url = buildMpUrl(config);

  for (const event of events) {
    const base = event as SyntheticBaseEvent;
    const payload = buildMpPayload(base, config.measurementId);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`MP request failed: ${response.status} ${response.statusText}`);
    }
  }
}

/**
 * Build the Measurement Protocol URL for sGTM.
 */
function buildMpUrl(config: TransportConfig): string {
  const base = config.sgtmUrl.replace(/\/$/, '');
  return `${base}/mp/collect?measurement_id=${config.measurementId}&api_secret=${config.apiSecret}`;
}

/**
 * Build a Measurement Protocol payload from a synthetic event.
 */
export function buildMpPayload(
  event: SyntheticBaseEvent,
  measurementId: string,
): Record<string, unknown> {
  // Extract custom parameters (everything beyond base fields)
  const {
    iap_source,
    event: eventName,
    timestamp,
    session_id,
    iap_session_id,
    page_path,
    page_title,
    consent_analytics,
    consent_marketing,
    consent_preferences,
    utm_source,
    utm_medium,
    utm_campaign,
    ...customParams
  } = event;

  return {
    client_id: session_id,
    events: [
      {
        name: eventName,
        params: {
          iap_source: true,
          session_id,
          iap_session_id,
          page_location: `https://iampatterson-com.vercel.app${page_path}`,
          page_title,
          page_path,
          consent_analytics,
          consent_marketing,
          consent_preferences,
          ...(utm_source ? { utm_source } : {}),
          ...(utm_medium ? { utm_medium } : {}),
          ...(utm_campaign ? { utm_campaign } : {}),
          ...customParams,
          engagement_time_msec: 100,
        },
      },
    ],
  };
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
