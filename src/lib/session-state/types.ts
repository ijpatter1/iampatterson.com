/**
 * Session State — visible to the visitor in the overlay's Session State tab,
 * drives the contextual contact-form CTA, and (optionally, per deliverable 8)
 * rides along on contact form submissions.
 *
 * Canonical shape: `docs/UX_PIVOT_SPEC.md` §3.6. Storage: tab-scoped
 * sessionStorage under `iampatterson.session_state`. A returning visitor
 * starts fresh — aligned with the `_iap_sid` cookie lifecycle.
 */

/** Ecommerce demo funnel stages — monotonic set, ordered by first-reached. */
export type EcommerceStage = 'product_view' | 'add_to_cart' | 'begin_checkout' | 'purchase';

/**
 * Canonical funnel order for rendering. `stages_reached` may contain stages in
 * first-reached order (a deep-linked visitor can fire `purchase` before
 * `product_view`); consumers rendering the funnel should iterate this sequence
 * and use `stages_reached.includes(stage)` for membership, not iterate
 * `stages_reached` directly.
 */
export const ECOMMERCE_FUNNEL_SEQUENCE: readonly EcommerceStage[] = [
  'product_view',
  'add_to_cart',
  'begin_checkout',
  'purchase',
] as const;

/** Consent signal values mirrored into the Session State snapshot. */
export type ConsentValue = 'granted' | 'denied';

export interface SessionState {
  /** Matches the `_iap_sid` cookie (same identifier flowing into sGTM). */
  session_id: string;
  /** ISO 8601 timestamp of the session's first SessionState write. */
  started_at: string;
  /** Count of distinct page paths visited this session. */
  page_count: number;
  /**
   * Ordered list of distinct page paths seen. Backs `page_count`; separated so
   * the reducer can dedupe `page_view` events by path across reloads without a
   * second derivation pass.
   */
  visited_paths: string[];
  /** Per-event-name fire counts for the lifetime of the session. */
  events_fired: { [event_name: string]: number };
  event_type_coverage: {
    /** Distinct event names fired this session (insertion order). */
    fired: string[];
    /**
     * Every distinct event name defined in the schema, derived at module init
     * from `DATA_LAYER_EVENT_NAMES`. No hardcoded count anywhere in the
     * coverage pipeline (Phase 9E deliverable 4).
     */
    total: string[];
  };
  demo_progress: {
    ecommerce: {
      /**
       * Monotonic set of stages the visitor has reached. Order is first-reached
       * for temporal audit; consumers rendering the funnel should iterate
       * `ECOMMERCE_FUNNEL_SEQUENCE` and test membership via `.includes`.
       */
      stages_reached: EcommerceStage[];
      percentage: number;
    };
  };
  consent_snapshot: {
    analytics: ConsentValue;
    marketing: ConsentValue;
    preferences: ConsentValue;
  };
  /** ISO 8601 timestamp — updated on every applied event. */
  updated_at: string;
}
