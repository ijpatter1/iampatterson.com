/**
 * Data layer event schema for iampatterson.com.
 *
 * All browser-side event tracking flows through these typed interfaces.
 * This is the contract between the frontend and GTM.
 */

/** Base shape shared by all data layer events. */
export interface BaseEvent {
  /** Marker identifying this as an iampatterson custom event (filters out GA4 auto-events in sGTM). */
  iap_source: true;
  event: string;
  timestamp: string;
  session_id: string;
  /** Session ID under a name GA4 won't remap (GA4 remaps session_id to ga_session_id). */
  iap_session_id: string;
  page_path: string;
  page_title: string;
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
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

// --- E-commerce demo events (Phase 6) ---

/** Fired when a product detail page is viewed. */
export interface ProductViewEvent extends BaseEvent {
  event: 'product_view';
  product_id: string;
  product_name: string;
  product_price: number;
  product_category: string;
}

/** Fired when a product is added to cart. */
export interface AddToCartEvent extends BaseEvent {
  event: 'add_to_cart';
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

/** Fired when the checkout flow begins. */
export interface BeginCheckoutEvent extends BaseEvent {
  event: 'begin_checkout';
  cart_total: number;
  item_count: number;
}

/** Fired on order completion. */
export interface PurchaseEvent extends BaseEvent {
  event: 'purchase';
  order_id: string;
  order_total: number;
  item_count: number;
  /** JSON-stringified array of {product_id, product_name, price, quantity}. */
  products: string;
}

// --- Subscription demo events (Phase 6) ---

/** Fired when a subscription plan is selected/viewed. */
export interface PlanSelectEvent extends BaseEvent {
  event: 'plan_select';
  plan_id: string;
  plan_name: string;
  plan_price: number;
}

/** Fired when a user signs up for a trial. */
export interface TrialSignupEvent extends BaseEvent {
  event: 'trial_signup';
  plan_id: string;
  plan_name: string;
  plan_price: number;
}

// --- Lead gen demo events (Phase 6) ---

/** Fired on form submission with qualifying fields. */
export interface FormCompleteEvent extends BaseEvent {
  event: 'form_complete';
  form_name: string;
  partnership_type: string;
  budget_range: string;
  company_name: string;
}

/** Fired when a lead is qualified (simulated). */
export interface LeadQualifyEvent extends BaseEvent {
  event: 'lead_qualify';
  lead_id: string;
  qualification_tier: string;
  partnership_type: string;
  budget_range: string;
}

/** Union of all event types. */
export type DataLayerEvent =
  | PageViewEvent
  | ScrollDepthEvent
  | ClickNavEvent
  | ClickCtaEvent
  | FormFieldFocusEvent
  | FormStartEvent
  | FormSubmitEvent
  | ConsentUpdateEvent
  | ProductViewEvent
  | AddToCartEvent
  | BeginCheckoutEvent
  | PurchaseEvent
  | PlanSelectEvent
  | TrialSignupEvent
  | FormCompleteEvent
  | LeadQualifyEvent;
