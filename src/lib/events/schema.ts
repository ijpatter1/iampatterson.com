/**
 * Data layer event schema for iampatterson.com.
 *
 * All browser-side event tracking flows through these typed interfaces.
 * This is the contract between the frontend and GTM.
 */

/** Base shape shared by all data layer events. */
export interface BaseEvent {
  event: string;
  timestamp: string;
  session_id: string;
  page_path: string;
  page_title: string;
}

/** Fired on App Router route changes. */
export interface PageViewEvent extends BaseEvent {
  event: 'page_view';
  page_referrer: string;
}

/** Fired at 25%, 50%, 75%, 100% scroll thresholds. */
export interface ScrollDepthEvent extends BaseEvent {
  event: 'scroll_depth';
  depth_percentage: number;
  depth_pixels: number;
}

/** Fired when a navigation link is clicked. */
export interface ClickNavEvent extends BaseEvent {
  event: 'click_nav';
  link_text: string;
  link_url: string;
}

/** Fired when a CTA button is clicked. */
export interface ClickCtaEvent extends BaseEvent {
  event: 'click_cta';
  cta_text: string;
  cta_location: string;
}

/** Fired when a user focuses a form field. */
export interface FormFieldFocusEvent extends BaseEvent {
  event: 'form_field_focus';
  form_name: string;
  field_name: string;
}

/** Fired on first interaction with a form (once per form per session). */
export interface FormStartEvent extends BaseEvent {
  event: 'form_start';
  form_name: string;
}

/** Fired on form submission. */
export interface FormSubmitEvent extends BaseEvent {
  event: 'form_submit';
  form_name: string;
  form_success: boolean;
}

/** Fired when Cookiebot consent state changes. */
export interface ConsentUpdateEvent extends BaseEvent {
  event: 'consent_update';
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
}

/** Union of all Phase 1 event types. */
export type DataLayerEvent =
  | PageViewEvent
  | ScrollDepthEvent
  | ClickNavEvent
  | ClickCtaEvent
  | FormFieldFocusEvent
  | FormStartEvent
  | FormSubmitEvent
  | ConsentUpdateEvent;
