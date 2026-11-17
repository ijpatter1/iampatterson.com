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
  /**
   * Cross-session identifier minted into `_iap_aid` cookie (365d, SameSite=Lax,
   * Secure in prod). Phase 10d D7. Threaded into every data-layer event as an
   * identifier that survives session expiry, in contrast to `session_id` which
   * rotates on the 30-min idle window. It goes no further today: the web
   * container does not send it, the Pub/Sub template does not forward it and
   * BigQuery has no column for it. A Statistics cookie (Ian, 2026-11-14):
   * empty string unless analytics consent is granted, and during SSR. Treat
   * empty as "no ID", never as one shared visitor.
   */
  anonymous_id: string;
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

/**
 * Phase 10d D3: page-level engagement signal.
 *
 * Fires at 15s, 60s, 180s of *engaged* time on a page. "Engaged" means the
 * tab is foregrounded and the page is visible — the tracker pauses its
 * counter when `document.hidden` flips true (Page Visibility API) and
 * resumes when the tab returns. The 1s tick that drives the counter only
 * runs when the page is mounted, so SPA route changes reset the
 * threshold-fired set.
 *
 * Closes the gap left by `scroll_depth`: milestone-bucket scroll signals
 * (25/50/75/100) lose information about the actual high-water-mark scroll
 * percentage and tell us nothing about time spent. `page_engagement`
 * carries the real `max_scroll_pct` at the moment of firing so a per-page
 * scroll-distribution analysis can use the unbucketed value, and the
 * `engagement_seconds` threshold is the time-on-page distribution we
 * couldn't compute from `page_view` alone (no end-of-engagement signal).
 */
export interface PageEngagementEvent extends BaseEvent {
  event: 'page_engagement';
  /** Threshold the firing crossed: 15, 60, or 180 seconds of engaged time. */
  engagement_seconds: 15 | 60 | 180;
  /** High-water-mark scroll percentage at firing, 0-100, unbucketed. */
  max_scroll_pct: number;
}

// --- Claudish translator (feat/claudish) ---

/**
 * Fired once per terminal translation outcome on /claudish (aborted
 * requests never fire — an abort is a keystroke). Params are counts,
 * durations, and closed enums only: the input and output text never
 * enter the data layer ("no input bodies logged" extends to analytics).
 */
export interface ClaudishTranslateEvent extends BaseEvent {
  event: 'claudish_translate';
  direction: 'en_to_claudish' | 'claudish_to_en';
  /** auto = debounced translate-as-you-type; manual = swap/share-driven. */
  source_mode: 'auto' | 'manual';
  detected_language: 'en' | 'en-x-claudish' | 'none';
  detector_source: 'ccld' | 'heuristic';
  outcome: 'complete' | 'refused' | 'capacity' | 'error';
  input_chars: number;
  input_em_dashes: number;
  /** 0 on refusal (partials are discarded, never counted). */
  output_chars: number;
  /** Time to first streamed token; 0 on cache hits and non-complete outcomes. */
  ttft_ms: number;
  duration_ms: number;
  cache: 'miss' | 'client' | 'server';
}

/**
 * Fired at most once per session per detected language (sessionStorage
 * gate in the caller): captures visitors who typed Claudish but never
 * paused long enough to translate.
 */
export interface ClaudishDetectedEvent extends BaseEvent {
  event: 'claudish_detected';
  detected_language: 'en' | 'en-x-claudish';
  detector_source: 'ccld' | 'heuristic';
  input_chars: number;
}

/**
 * One distribution event for both ends of the share loop. Copy folds in
 * as copy_output (same intent: take this elsewhere). share_url_chars is a
 * LENGTH — the URL itself is the input text and must never be logged.
 */
export interface ClaudishShareEvent extends BaseEvent {
  event: 'claudish_share';
  share_action: 'copy_output' | 'copy_link' | 'web_share' | 'opened_shared_link';
  direction: 'en_to_claudish' | 'claudish_to_en';
  output_chars: number;
  share_truncated: boolean;
  share_url_chars: number;
  /** True when the output on screen is a stored sample (the opening example included), not a live translation (22.1). */
  from_sample: boolean;
}

/** The rate-modal thumbs: "Holds up." / "You're absolutely right." */
export interface ClaudishRateEvent extends BaseEvent {
  event: 'claudish_rate';
  rating: 'holds_up' | 'absolutely_right';
  direction: 'en_to_claudish' | 'claudish_to_en';
  output_chars: number;
  /** True when the rated output is a stored sample, not a live translation (22.1). */
  from_sample: boolean;
}

/**
 * A tap on a "Try one" card (22.1). The sample is identified by its
 * number, never its text. The opening example fires nothing: it is on the
 * page before anyone acts.
 */
export interface ClaudishSamplePickEvent extends BaseEvent {
  event: 'claudish_sample_pick';
  /** 1-based position of the card, in the order the page shows them. */
  sample_index: number;
  direction: 'en_to_claudish' | 'claudish_to_en';
}

/** Fired when a navigation link is clicked. */
export interface ClickNavEvent extends BaseEvent {
  event: 'click_nav';
  link_text: string;
  link_url: string;
}

/**
 * Closed enum of `cta_location` values for `click_cta` emissions. Every call
 * to action has its own value, so two buttons on one page can be told apart
 * in the click data. The footer's three Session links share `footer_session`,
 * as they always have; `cta_text` tells them apart.
 *
 * Nav-adjacent values name their affordance (`session_pulse`, `portal_*`);
 * page values name their page and place (`hero_review`, `review_page_top`).
 * The "etc." escape hatch is closed: a new call to action extends this union.
 *
 * 15.4 removed the values whose calls to action were deleted: `hero` (the old
 * hero, split into `hero_review` and `hero_session`), `final_cta`,
 * `demo_card_ecommerce` and `pipeline_see_your_session`, plus `review` and
 * `proof`, which preview deploys emitted before 15.4 split them. 16.1 removed
 * `portal_services`, `services_closer` and `services_tier_01` to `_04` with
 * the services page. `portal_services` was never emitted (the portals fire
 * `portal_click`), so the BigQuery description doesn't list it as retired.
 * Rows already in BigQuery keep them; `infrastructure/bigquery/schema.json`
 * documents both sets.
 */
export type CtaLocation =
  // The header and the overlay
  | 'session_pulse'
  | 'header_review'
  | 'portal_contact'
  | 'contact_cta_threshold'
  // The homepage (15.4)
  | 'hero_review'
  | 'hero_session'
  | 'how_we_work_link'
  | 'how_we_work_review'
  | 'proof_button'
  | 'proof_panel'
  // /review and /contact (15.4)
  | 'review_page_top'
  | 'review_page_bottom'
  | 'contact_review_link'
  | 'contact_email'
  // The footer (15.4); footer_session is the three Session links, as before
  | 'footer_contact'
  | 'footer_email'
  | 'footer_session'
  // The end of the shop demo, its confirmation page
  | 'shop_confirmation_review';

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
  destination: 'contact';
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
 * Rendered as a coverage chip on the Overview tab like any other session
 * event, not hidden. The session is everything that flows through the
 * stack during the visitor's time on the site, not only events the
 * visitor triggers explicitly — nav hints render without participation
 * too. Hiding `web_vital` would contradict the "making the invisible
 * visible" thesis the overlay exists to demonstrate.
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
  | WebVitalEvent
  | PageEngagementEvent
  | ClaudishTranslateEvent
  | ClaudishDetectedEvent
  | ClaudishShareEvent
  | ClaudishRateEvent
  | ClaudishSamplePickEvent;

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
  'page_engagement',
  'claudish_translate',
  'claudish_detected',
  'claudish_share',
  'claudish_rate',
  'claudish_sample_pick',
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
