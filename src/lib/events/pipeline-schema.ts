/**
 * Pipeline event schema for the real-time event stream.
 *
 * This defines the standardized JSON shape for events flowing through
 * sGTM → Pub/Sub → Cloud Run → browser. It wraps the original data layer
 * event with pipeline metadata, consent state, and routing information.
 */

/** Known routing destinations in the event pipeline. */
export const ROUTING_DESTINATIONS = Object.freeze([
  'ga4',
  'bigquery',
  'meta_capi',
  'google_ads',
  'pubsub',
] as const);

export type RoutingDestination = (typeof ROUTING_DESTINATIONS)[number];

/** Consent Mode v2 signal values. */
type ConsentSignal = 'granted' | 'denied';

/** Consent state at the time an event was processed by sGTM. */
export interface ConsentState {
  analytics_storage: ConsentSignal;
  ad_storage: ConsentSignal;
  ad_user_data: ConsentSignal;
  ad_personalization: ConsentSignal;
  functionality_storage: ConsentSignal;
}

/** The result of routing an event to a destination. */
export interface RoutingResult {
  destination: RoutingDestination | string;
  status: 'sent' | 'blocked_consent' | 'error';
  timestamp: string;
}

/**
 * A pipeline event — the standardized shape flowing through the
 * real-time event stream (Pub/Sub → Cloud Run → browser).
 */
export interface PipelineEvent {
  /** Unique ID for this pipeline message. */
  pipeline_id: string;
  /** ISO 8601 timestamp when sGTM received and published the event. */
  received_at: string;
  /** Session ID from the _iap_sid cookie. */
  session_id: string;
  /** Original event name (e.g., 'page_view', 'click_cta'). */
  event_name: string;
  /** Client-side ISO 8601 timestamp from the data layer push. */
  timestamp: string;
  /** Page pathname (e.g., '/services'). */
  page_path: string;
  /** Document title. */
  page_title: string;
  /** Full page URL. */
  page_location: string;
  /** Event-specific parameters (varies by event type). */
  parameters: Record<string, string | number | boolean>;
  /** Consent Mode v2 state at the time of event processing. */
  consent: ConsentState;
  /** Routing results — which destinations received this event and their status. */
  routing: RoutingResult[];
}

const ROUTING_STATUSES = new Set<string>(['sent', 'blocked_consent', 'error']);

function isRoutingResult(value: unknown): value is RoutingResult {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.destination === 'string' &&
    typeof obj.status === 'string' &&
    ROUTING_STATUSES.has(obj.status) &&
    typeof obj.timestamp === 'string'
  );
}

const CONSENT_KEYS: readonly (keyof ConsentState)[] = [
  'analytics_storage',
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
  'functionality_storage',
];

const CONSENT_VALUES = new Set<string>(['granted', 'denied']);

function isConsentState(value: unknown): value is ConsentState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return CONSENT_KEYS.every(
    (key) => typeof obj[key] === 'string' && CONSENT_VALUES.has(obj[key] as string),
  );
}

/** Runtime type guard for PipelineEvent — validates parsed JSON from the event stream. */
export function isPipelineEvent(data: unknown): data is PipelineEvent {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.pipeline_id === 'string' &&
    typeof obj.received_at === 'string' &&
    typeof obj.session_id === 'string' &&
    typeof obj.event_name === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.page_path === 'string' &&
    typeof obj.page_title === 'string' &&
    typeof obj.page_location === 'string' &&
    typeof obj.parameters === 'object' &&
    obj.parameters !== null &&
    Array.isArray(obj.routing) &&
    (obj.routing as unknown[]).every(isRoutingResult) &&
    isConsentState(obj.consent)
  );
}

let counter = 0;

/** Factory for creating well-formed pipeline events. Auto-generates pipeline_id and received_at if not provided. */
export function createPipelineEvent(
  input: Omit<PipelineEvent, 'pipeline_id' | 'received_at'> &
    Partial<Pick<PipelineEvent, 'pipeline_id' | 'received_at'>>,
): PipelineEvent {
  return {
    pipeline_id: input.pipeline_id ?? `pipe-${Date.now()}-${++counter}`,
    received_at: input.received_at ?? new Date().toISOString(),
    ...input,
  };
}
