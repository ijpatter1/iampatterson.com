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

/**
 * Closed enum of `cta_location` values for `click_cta` emissions.
 *
 * Nav-adjacent CTAs (Phase 9E deliverable 9 closed set) must use one of:
 * `session_pulse`, `portal_services`, `portal_about`, `portal_contact`,
 * `contact_cta_threshold`, `pipeline_see_your_session`, `footer_session`.
 * The "etc." escape hatch is closed, adding a nav-adjacent CTA extends this
 * union explicitly.
 *
 * Editorial / page-specific CTAs live alongside the nav-adjacent set in the
 * same union so `ClickCtaEvent.cta_location` receives a single type check at
 * every call site; distinguishing them as branded sub-types would require
 * every caller to pick a sub-type at the call site without adding safety.
 * Naming convention communicates intent: nav-adjacent values name their
 * affordance (`session_pulse`, `portal_*`); editorial values name their
 * page or region (`hero`, `final_cta`, `services_tier_NN`).
 *
 * Legacy values (pre-Phase-9E demos that 9E removes or rebuilds) stay in the
 * union until their emitting components are deleted or rewritten: they
 * guarantee continuity through the pivot's implementation passes. They are
 * expected to leave the union when deliverables 6 and 7 ship.
 */
export type CtaLocation =
  // Phase 9E nav-adjacent closed enum
  | 'session_pulse'
  | 'portal_services'
  | 'portal_about'
  | 'portal_contact'
  | 'contact_cta_threshold'
  | 'pipeline_see_your_session'
  | 'footer_session'
  // Editorial / page-specific CTAs (not nav-adjacent, named by page or region)
  | 'hero'
  | 'services_closer'
  | `services_tier_${'01' | '02' | '03' | '04'}`
  | 'final_cta'
  | 'about_closer'
  // Homepage Demos section, single ecommerce entry after D6's rebuild. Name
  // retained across the card→section refactor so the analytics time series
  // stays continuous (no split series from a rename).
  | 'demo_card_ecommerce';

/** Fired when a CTA button is clicked. */
export interface ClickCtaEvent extends BaseEvent {
  event: 'click_cta';
  cta_text: string;
  cta_location: CtaLocation;
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

/** Fired when a product is removed from the cart (via the remove link or
 *  by decrementing quantity to 0). Added 2026-04-21 in UAT r2 follow-up,
 *  the walkthrough copy advertised the event but no code path fired it.
 *  `quantity` is the number of units removed (matches GA4's convention). */
export interface RemoveFromCartEvent extends BaseEvent {
  event: 'remove_from_cart';
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

// --- Phase 9E deliverable 9, nav & Session State analytics ---

/**
 * Fired once when the first-session pulse-ring hint renders on the homepage.
 * Gated to once-per-session via `sessionStorage` at `iampatterson.nav_hint.shown`.
 */
export interface NavHintShownEvent extends BaseEvent {
  event: 'nav_hint_shown';
}

/**
 * Fired when the first-session nav hint clears WITHOUT conversion. Three
 * dismissal modes, all of which represent the visitor not engaging with
 * the hint's call-to-action:
 *
 * - `scroll`, any `scroll` event on `document` (visitor scrolled away).
 * - `click_outside`, any `click` whose target is not `SessionPulse` or a
 *   descendant (visitor clicked something unrelated).
 * - `timeout`, the ~10s auto-clear timer elapsed without user interaction.
 *
 * Clicking `SessionPulse` itself is the hint's *conversion*, not a
 * dismissal, it does NOT fire `nav_hint_dismissed`. The conversion is
 * tracked by the existing `click_cta` emission with
 * `cta_location: 'session_pulse'`. Conflating conversions with dismissals
 * in the same event stream would make the dismissal metric useless for BI
 * (`COUNT(*) WHERE event = 'nav_hint_dismissed'` would report "how many
 * visitors saw the hint and reacted in any way," which answers no useful
 * product question). Removed the pre-UAT `click_session_pulse` enum value
 * for this reason; the hint still hides visually on SessionPulse click,
 * just without emitting a dismissal event.
 *
 * Full hint lifecycle and dismissal contract in `docs/REQUIREMENTS.md`
 * Phase 9E deliverable 1.
 */
export interface NavHintDismissedEvent extends BaseEvent {
  event: 'nav_hint_dismissed';
  dismissal_mode: 'scroll' | 'click_outside' | 'timeout';
}

/**
 * Fired when the visitor hovers the `SessionPulse` affordance without clicking.
 * Desktop-only; debounced to at most once per 60 seconds per session; suppressed
 * under a coarse-pointer media query.
 */
export interface SessionPulseHoverEvent extends BaseEvent {
  event: 'session_pulse_hover';
}

/**
 * Fired when the overlay opens onto the Overview tab.
 * `default_landing` = fresh open; `manual_select` = tab re-selected from Timeline or Consent.
 */
export interface OverviewTabViewEvent extends BaseEvent {
  event: 'overview_tab_view';
  source: 'default_landing' | 'manual_select';
}

/**
 * Fired when the overlay opens onto the Timeline tab. Parallel to
 * OverviewTabViewEvent, kept as a distinct event (not a discriminator on a
 * single `tab_view`) so each tab gets its own coverage chip and the meter
 * can signal depth-of-exploration across the three tabs.
 */
export interface TimelineTabViewEvent extends BaseEvent {
  event: 'timeline_tab_view';
  source: 'default_landing' | 'manual_select';
}

/**
 * Fired when the overlay opens onto the Consent tab. See TimelineTabViewEvent
 * for the depth-of-exploration rationale.
 */
export interface ConsentTabViewEvent extends BaseEvent {
  event: 'consent_tab_view';
  source: 'default_landing' | 'manual_select';
}

/**
 * Fired when a portal link inside the Overview tab is clicked. Distinct from
 * `click_cta` so the portal's conversion rate is isolable.
 */
export interface PortalClickEvent extends BaseEvent {
  event: 'portal_click';
  destination: 'services' | 'about' | 'contact';
}

/**
 * Fired once per session when event-type coverage crosses a threshold. Monotonic
 * within a session, each threshold fires at most once even if coverage oscillates.
 */
export interface CoverageMilestoneEvent extends BaseEvent {
  event: 'coverage_milestone';
  threshold: 25 | 50 | 75 | 100;
}

// --- Phase 10 D1, Core Web Vitals telemetry ---

/**
 * Fired by the `web-vitals` library once per CWV metric per page visit.
 * LCP, CLS, INP settle on the page-hide / `visibilitychange` tick (the
 * library folds intermediate updates into one emission); FCP and TTFB
 * settle earlier in the lifecycle.
 *
 * `metric_rating` is Google's `good` / `needs-improvement` / `poor`
 * bucket applied by the library against the current CWV thresholds — we
 * defer the bucket to the library rather than re-deriving it so the
 * cutoffs track upstream when Google moves them.
 *
 * Excluded from `RENDERABLE_EVENT_NAMES` via `HIDDEN_FROM_COVERAGE`:
 * this is performance telemetry, not user behaviour, so showing it as
 * an Overview coverage chip would light trivially on every page view
 * and drown the depth-of-exploration signal the meter is for.
 */
export interface WebVitalEvent extends BaseEvent {
  event: 'web_vital';
  metric_name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
  metric_value: number;
  metric_rating: 'good' | 'needs-improvement' | 'poor';
  metric_id: string;
  navigation_type: string;
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
  | RemoveFromCartEvent
  | BeginCheckoutEvent
  | PurchaseEvent
  | PlanSelectEvent
  | TrialSignupEvent
  | FormCompleteEvent
  | LeadQualifyEvent
  | NavHintShownEvent
  | NavHintDismissedEvent
  | SessionPulseHoverEvent
  | OverviewTabViewEvent
  | TimelineTabViewEvent
  | ConsentTabViewEvent
  | PortalClickEvent
  | CoverageMilestoneEvent
  | WebVitalEvent;

/**
 * Runtime array of every distinct `event` string literal in the `DataLayerEvent`
 * union. The single source of truth for code that needs to iterate event names,
 * consumers like `useDataLayerEvents` (which filters the window.dataLayer by
 * iap_source event name), the Session State coverage denominator (Phase 9E
 * deliverable 4), and any future introspection tooling derive from this array.
 *
 * This is the "derive-from-schema day-one" rule in practice: no hardcoded `16`
 * or `22` magic numbers anywhere; consumers read `.length` or membership-test
 * via this array.
 */
export const DATA_LAYER_EVENT_NAMES = [
  'page_view',
  'scroll_depth',
  'click_nav',
  'click_cta',
  'form_field_focus',
  'form_start',
  'form_submit',
  'consent_update',
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'purchase',
  'plan_select',
  'trial_signup',
  'form_complete',
  'lead_qualify',
  'nav_hint_shown',
  'nav_hint_dismissed',
  'session_pulse_hover',
  'overview_tab_view',
  'timeline_tab_view',
  'consent_tab_view',
  'portal_click',
  'coverage_milestone',
  'web_vital',
] as const;

/**
 * Event names hidden from the Overview coverage chip grid. Subscription
 * + lead-gen event types remain in the full schema (BQ columns still
 * populated, infrastructure continuity, future reintroduction after 9F)
 * but are hidden here so visitors don't see chips for events no current
 * surface can fire.
 *
 * Updates follow product-surface changes, not schema changes: adding a
 * new demo that fires an existing event removes that event from the
 * hidden set; re-introducing subscription or leadgen demos removes those
 * names.
 *
 * Exported so tests can verify `HIDDEN_FROM_COVERAGE ⊆ DATA_LAYER_EVENT_NAMES`
 * at runtime. The TypeScript `Set<DataLayerEventName>` type gives a
 * compile-time subset guarantee, but `tsc --noEmit` is not in CI (see
 * MEMORY.md) so the runtime backstop is load-bearing. A typo here (e.g.
 * `plan_selekt`) produces a `HIDDEN_FROM_COVERAGE` entry that doesn't
 * match any real event name, without the runtime pin, the
 * `RENDERABLE_EVENT_NAMES.filter(...)` silently returns the real
 * `plan_select` chip as renderable, and nothing fails until a human
 * inspects the Overview chip grid.
 */
export const HIDDEN_FROM_COVERAGE: ReadonlySet<DataLayerEventName> = new Set<DataLayerEventName>([
  'plan_select',
  'trial_signup',
  'form_complete',
  'lead_qualify',
  // `web_vital` is Phase 10 D1 CWV telemetry, not a user-interaction event.
  // It fires on every page view (5 metrics per load), so a renderable chip
  // would light trivially and pollute the Overview depth-of-exploration
  // signal. The event still flows through the standard pipeline and lands
  // in BigQuery; the hide is purely a visitor-surface concern.
  'web_vital',
]);

export const RENDERABLE_EVENT_NAMES: readonly DataLayerEventName[] = DATA_LAYER_EVENT_NAMES.filter(
  (n) => !HIDDEN_FROM_COVERAGE.has(n),
);

/** Union of every event name literal, derived from `DATA_LAYER_EVENT_NAMES`. */
export type DataLayerEventName = (typeof DATA_LAYER_EVENT_NAMES)[number];

/**
 * Compile-time cross-check: `DATA_LAYER_EVENT_NAMES` must match the set of
 * event literals in `DataLayerEvent` exactly. If adding a new event to the
 * union but not to the array (or vice versa), one of these branches resolves
 * to an `'ERROR: ...'` string literal and the assignment to `true` fails.
 */
type _AssertEventNamesInSync = [DataLayerEvent['event']] extends [DataLayerEventName]
  ? [DataLayerEventName] extends [DataLayerEvent['event']]
    ? true
    : 'ERROR: DATA_LAYER_EVENT_NAMES contains a name not present in the DataLayerEvent union'
  : 'ERROR: DataLayerEvent union contains an event name not present in DATA_LAYER_EVENT_NAMES';

const _eventNamesInSync: _AssertEventNamesInSync = true;
