import { pushEvent } from './push';
import { getSessionId } from './session';

function baseFields(): {
  timestamp: string;
  session_id: string;
  page_path: string;
  page_title: string;
} {
  return {
    timestamp: new Date().toISOString(),
    session_id: getSessionId(),
    page_path: window.location.pathname,
    page_title: document.title,
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
  pushEvent({
    ...baseFields(),
    event: 'consent_update',
    consent_analytics: analytics,
    consent_marketing: marketing,
    consent_preferences: preferences,
  });
}
