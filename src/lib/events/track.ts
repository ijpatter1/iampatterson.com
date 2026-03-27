import { pushEvent } from './push';
import { getSessionId } from './session';

/** Current consent state — updated by trackConsentUpdate and initConsentState. */
let currentConsent = {
  consent_analytics: false,
  consent_marketing: false,
  consent_preferences: false,
};

/** Initialize consent state from Cookiebot (call on page load). */
export function initConsentState(
  analytics: boolean,
  marketing: boolean,
  preferences: boolean,
): void {
  currentConsent = {
    consent_analytics: analytics,
    consent_marketing: marketing,
    consent_preferences: preferences,
  };
}

function baseFields(): {
  iap_source: true;
  timestamp: string;
  session_id: string;
  page_path: string;
  page_title: string;
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
} {
  return {
    iap_source: true,
    timestamp: new Date().toISOString(),
    session_id: getSessionId(),
    page_path: window.location.pathname,
    page_title: document.title,
    ...currentConsent,
  };
}

export function trackPageView(referrer: string): void {
  pushEvent({ ...baseFields(), event: 'page_view', page_referrer: referrer });
}

export function trackClickNav(linkText: string, linkUrl: string): void {
  pushEvent({ ...baseFields(), event: 'click_nav', link_text: linkText, link_url: linkUrl });
}

export function trackClickCta(ctaText: string, ctaLocation: string): void {
  pushEvent({ ...baseFields(), event: 'click_cta', cta_text: ctaText, cta_location: ctaLocation });
}

export function trackFormFieldFocus(formName: string, fieldName: string): void {
  pushEvent({
    ...baseFields(),
    event: 'form_field_focus',
    form_name: formName,
    field_name: fieldName,
  });
}

export function trackFormStart(formName: string): void {
  pushEvent({ ...baseFields(), event: 'form_start', form_name: formName });
}

export function trackFormSubmit(formName: string, success: boolean): void {
  pushEvent({ ...baseFields(), event: 'form_submit', form_name: formName, form_success: success });
}

export function trackScrollDepth(percentage: number, pixels: number): void {
  pushEvent({
    ...baseFields(),
    event: 'scroll_depth',
    depth_percentage: percentage,
    depth_pixels: pixels,
  });
}

export function trackConsentUpdate(
  analytics: boolean,
  marketing: boolean,
  preferences: boolean,
): void {
  currentConsent = {
    consent_analytics: analytics,
    consent_marketing: marketing,
    consent_preferences: preferences,
  };
  pushEvent({
    ...baseFields(),
    event: 'consent_update',
  });

  // Also beacon directly to the event stream service so consent
  // withdrawal events reach the overlay even when GA4 Consent Mode
  // blocks the transport layer.
  beaconConsentToEventStream();
}

function beaconConsentToEventStream(): void {
  const baseUrl = process.env.NEXT_PUBLIC_EVENT_STREAM_URL;
  if (!baseUrl) return;

  const fields = baseFields();
  const endpoint = baseUrl.replace(/\/+$/, '').replace(/\/events$/, '');

  fetch(`${endpoint}/consent-beacon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: fields.session_id,
      event_name: 'consent_update',
      timestamp: fields.timestamp,
      page_path: fields.page_path,
      page_title: fields.page_title,
      page_location: window.location.href,
      parameters: {
        consent_analytics: fields.consent_analytics,
        consent_marketing: fields.consent_marketing,
        consent_preferences: fields.consent_preferences,
      },
      consent: {
        analytics_storage: fields.consent_analytics ? 'granted' : 'denied',
        ad_storage: fields.consent_marketing ? 'granted' : 'denied',
        ad_user_data: fields.consent_marketing ? 'granted' : 'denied',
        ad_personalization: fields.consent_marketing ? 'granted' : 'denied',
        functionality_storage: fields.consent_preferences ? 'granted' : 'denied',
      },
      routing: [
        {
          destination: 'ga4',
          status: fields.consent_analytics ? 'sent' : 'blocked_consent',
          timestamp: fields.timestamp,
        },
        {
          destination: 'bigquery',
          status: fields.consent_analytics ? 'sent' : 'blocked_consent',
          timestamp: fields.timestamp,
        },
        { destination: 'pubsub', status: 'sent', timestamp: fields.timestamp },
      ],
    }),
    keepalive: true,
  }).catch(() => {
    // Silently ignore — the GTM path may still deliver
  });
}
