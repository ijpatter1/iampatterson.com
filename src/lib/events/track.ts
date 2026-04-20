import { pushEvent } from './push';
import type {
  CoverageMilestoneEvent,
  CtaLocation,
  NavHintDismissedEvent,
  PortalClickEvent,
} from './schema';
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

/**
 * Read the module's current consent snapshot. The returned object is a copy —
 * safe to pass into a pure reducer without aliasing the mutable module state.
 */
export function getCurrentConsent(): {
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
} {
  return { ...currentConsent };
}

function baseFields(): {
  iap_source: true;
  timestamp: string;
  session_id: string;
  iap_session_id: string;
  page_path: string;
  page_title: string;
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
} {
  const sid = getSessionId();
  return {
    iap_source: true,
    timestamp: new Date().toISOString(),
    session_id: sid,
    iap_session_id: sid,
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

export function trackClickCta(ctaText: string, ctaLocation: CtaLocation): void {
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

// --- E-commerce demo tracking (Phase 6) ---

export function trackProductView(params: {
  product_id: string;
  product_name: string;
  product_price: number;
  product_category: string;
}): void {
  pushEvent({ ...baseFields(), event: 'product_view', ...params });
}

export function trackAddToCart(params: {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}): void {
  pushEvent({ ...baseFields(), event: 'add_to_cart', ...params });
}

export function trackBeginCheckout(params: { cart_total: number; item_count: number }): void {
  pushEvent({ ...baseFields(), event: 'begin_checkout', ...params });
}

export function trackPurchase(params: {
  order_id: string;
  order_total: number;
  item_count: number;
  products: string;
}): void {
  pushEvent({ ...baseFields(), event: 'purchase', ...params });
}

// --- Subscription demo tracking (Phase 6) ---

export function trackPlanSelect(params: {
  plan_id: string;
  plan_name: string;
  plan_price: number;
}): void {
  pushEvent({ ...baseFields(), event: 'plan_select', ...params });
}

export function trackTrialSignup(params: {
  plan_id: string;
  plan_name: string;
  plan_price: number;
}): void {
  pushEvent({ ...baseFields(), event: 'trial_signup', ...params });
}

// --- Lead gen demo tracking (Phase 6) ---

export function trackFormComplete(params: {
  form_name: string;
  partnership_type: string;
  budget_range: string;
  company_name: string;
}): void {
  pushEvent({ ...baseFields(), event: 'form_complete', ...params });
}

export function trackLeadQualify(params: {
  lead_id: string;
  qualification_tier: string;
  partnership_type: string;
  budget_range: string;
}): void {
  pushEvent({ ...baseFields(), event: 'lead_qualify', ...params });
}

// --- Phase 9E — nav & Session State analytics ---

export function trackCoverageMilestone(threshold: CoverageMilestoneEvent['threshold']): void {
  pushEvent({ ...baseFields(), event: 'coverage_milestone', threshold });
}

export function trackPortalClick(destination: PortalClickEvent['destination']): void {
  pushEvent({ ...baseFields(), event: 'portal_click', destination });
}

export function trackOverviewTabView(source: 'default_landing' | 'manual_select'): void {
  pushEvent({ ...baseFields(), event: 'overview_tab_view', source });
}

export function trackTimelineTabView(source: 'default_landing' | 'manual_select'): void {
  pushEvent({ ...baseFields(), event: 'timeline_tab_view', source });
}

export function trackConsentTabView(source: 'default_landing' | 'manual_select'): void {
  pushEvent({ ...baseFields(), event: 'consent_tab_view', source });
}

export function trackNavHintShown(): void {
  pushEvent({ ...baseFields(), event: 'nav_hint_shown' });
}

export function trackNavHintDismissed(mode: NavHintDismissedEvent['dismissal_mode']): void {
  pushEvent({ ...baseFields(), event: 'nav_hint_dismissed', dismissal_mode: mode });
}

export function trackSessionPulseHover(): void {
  pushEvent({ ...baseFields(), event: 'session_pulse_hover' });
}
