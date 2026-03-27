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
  _iap: true;
  timestamp: string;
  session_id: string;
  page_path: string;
  page_title: string;
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
} {
  return {
    _iap: true,
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
}
