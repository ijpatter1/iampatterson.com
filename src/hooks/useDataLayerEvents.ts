'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConsentState, PipelineEvent, RoutingResult } from '@/lib/events/pipeline-schema';

export interface UseDataLayerEventsOptions {
  /** Maximum events to keep in the buffer. Default: 100. */
  maxBufferSize?: number;
  /** Polling interval in ms. Default: 400. */
  pollInterval?: number;
}

export interface UseDataLayerEventsReturn {
  events: PipelineEvent[];
  clearEvents: () => void;
}

/** Known iap_source event names worth capturing. */
const IAP_EVENTS = new Set([
  'page_view',
  'scroll_depth',
  'click_nav',
  'click_cta',
  'form_start',
  'form_submit',
  'form_field_focus',
  'consent_update',
  'product_view',
  'add_to_cart',
  'begin_checkout',
  'purchase',
  'plan_select',
  'trial_signup',
  'form_complete',
  'lead_qualify',
]);

let dlCounter = 0;

function buildConsent(entry: Record<string, unknown>): ConsentState {
  const analytics = entry.consent_analytics === true;
  const marketing = entry.consent_marketing === true;
  const preferences = entry.consent_preferences === true;

  return {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
    functionality_storage: preferences ? 'granted' : 'denied',
  };
}

function buildRouting(consent: ConsentState, timestamp: string): RoutingResult[] {
  const marketingGranted = consent.ad_storage === 'granted';
  return [
    { destination: 'ga4', status: 'sent', timestamp },
    { destination: 'bigquery', status: 'sent', timestamp },
    { destination: 'pubsub', status: 'sent', timestamp },
    {
      destination: 'meta_capi',
      status: marketingGranted ? 'sent' : 'blocked_consent',
      timestamp,
    },
    {
      destination: 'google_ads',
      status: marketingGranted ? 'sent' : 'blocked_consent',
      timestamp,
    },
  ];
}

function extractParameters(
  entry: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const skip = new Set([
    'event',
    'iap_source',
    'timestamp',
    'session_id',
    'iap_session_id',
    'page_path',
    'page_title',
    'consent_analytics',
    'consent_marketing',
    'consent_preferences',
  ]);
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (skip.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params[key] = value;
    }
  }
  return params;
}

function dataLayerEntryToPipelineEvent(entry: Record<string, unknown>): PipelineEvent | null {
  if (entry.iap_source !== true) return null;

  const eventName = entry.event;
  if (typeof eventName !== 'string' || !IAP_EVENTS.has(eventName)) return null;

  const timestamp =
    typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString();
  const consent = buildConsent(entry);

  return {
    pipeline_id: `dl-${Date.now()}-${++dlCounter}`,
    received_at: new Date().toISOString(),
    session_id: typeof entry.session_id === 'string' ? entry.session_id : '',
    event_name: eventName,
    timestamp,
    page_path: typeof entry.page_path === 'string' ? entry.page_path : '',
    page_title: typeof entry.page_title === 'string' ? entry.page_title : '',
    page_location: typeof window !== 'undefined' ? window.location.href : '',
    parameters: extractParameters(entry),
    consent,
    routing: buildRouting(consent, timestamp),
  };
}

/**
 * Polls window.dataLayer and converts iap_source events into PipelineEvents.
 * This provides timeline data without requiring the SSE pipeline.
 */
export function useDataLayerEvents({
  maxBufferSize = 100,
  pollInterval = 400,
}: UseDataLayerEventsOptions = {}): UseDataLayerEventsReturn {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const lastIndexRef = useRef(0);
  const bufferSizeRef = useRef(maxBufferSize);
  bufferSizeRef.current = maxBufferSize;

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window === 'undefined' || !window.dataLayer) return;

      const dl = window.dataLayer;
      const newEvents: PipelineEvent[] = [];

      while (lastIndexRef.current < dl.length) {
        const entry = dl[lastIndexRef.current] as Record<string, unknown>;
        lastIndexRef.current++;
        const pipelineEvent = dataLayerEntryToPipelineEvent(entry);
        if (pipelineEvent) {
          newEvents.push(pipelineEvent);
        }
      }

      if (newEvents.length > 0) {
        setEvents((prev) => {
          const merged = [...newEvents.reverse(), ...prev];
          return merged.length > bufferSizeRef.current
            ? merged.slice(0, bufferSizeRef.current)
            : merged;
        });
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval]);

  return { events, clearEvents };
}
