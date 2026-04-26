# Site-self analytics coverage

**Phase:** 10d D3
**Date:** 2026-04-25
**Branch:** `phase/10d-launch-prep`

## Scope

The Phase 10d D3 deliverable, verbatim:

> **Site-self analytics remainder.** Original Phase 10 D4, minus the
> portion accelerated into 9E D9 (nav + Session State analytics already
> shipped). Remaining scope: demo interaction patterns, time-on-site /
> scroll-depth distribution beyond the bare milestones, funnel reach
> into the ecommerce demo, contact-form conversion signal, cross-event
> funnel reporting in Metabase or a lightweight dashboard surface.

This audit walks each sub-item against the existing event surface,
identifies the genuine gaps, and lands the gap-closers.

## Audit, sub-item by sub-item

### Demo interaction patterns

**Existing coverage:** `product_view`, `add_to_cart`, `remove_from_cart`,
`begin_checkout`, `purchase`. Plus the click-stream context: `page_view`,
`click_cta` (with `cta_location: 'demo_card_ecommerce'`),
`click_nav`. `purchase` carries `order_id`, `order_total`, `item_count`,
and a `products` blob.

**Verdict:** covered. The ecommerce funnel is fully instrumented end-to-end
since Phase 6 (commits `f...014`); 9F's native-reveal rebuild kept every
event firing through the rebuild and added `remove_from_cart` for
cart-decrement parity (UAT r2 follow-up commit `5...4`). No new event
needed.

### Time-on-site / scroll-depth distribution beyond bare milestones

**Existing coverage:** `scroll_depth` fires at 25/50/75/100 milestones
with `depth_percentage` and `depth_pixels`. `page_view` fires at every
SPA route change; CWV `web_vital` fires once per metric per page.

**Gap:** no time-on-page signal at all. `page_view` has no end. There's
also no high-water-mark scroll capture — the milestone bucket loses
information about a session that scrolled to 87% on a long page (it
fires the 75% milestone and never tells us about the 87%).

**Closed by:** new `page_engagement` event (Phase 10d D3). Fires at 15s,
60s, 180s of *engaged* time on a page. Engaged = `document.hidden ===
false` (Page Visibility API gates the counter). Each emission carries
the unbucketed `max_scroll_pct` at the moment of firing. SPA route
changes reset the threshold-fired set so a session that loiters on
multiple pages emits engagement signals per-page.

The 1Hz tick is cheap (single setInterval per mount, not per-event);
the visibility gate ensures we don't burn budget while the tab is
backgrounded.

### Funnel reach into the ecommerce demo

**Existing coverage:** `page_view` events with `page_path LIKE
'/demo/ecommerce%'` mark demo entry; per-stage events
(`product_view`, `add_to_cart`, `begin_checkout`, `purchase`) mark
progression. The events are there.

**Gap:** no per-session funnel mart in BigQuery. To answer "what
percentage of visitors who entered the demo reached checkout?" today,
a data analyst would have to write the GROUP-BY-session pivot from
scratch against `stg_events`. The analytical answer is computable
from the raw event stream but is friction-laden.

**Closed by:** new `mart_ecommerce_funnel` Dataform mart at
`infrastructure/dataform/definitions/marts/mart_ecommerce_funnel.sqlx`.
Pivots `stg_events` into one row per ecommerce session with binary
flags per stage (`has_demo_page_view`, `has_product_view`,
`has_add_to_cart`, `has_begin_checkout`, `has_purchase`), the deepest
`furthest_stage` reached, step-to-step conversion times in seconds,
and the order details for the converted set. Partitioned by
`DATE(session_start)`, clustered by `utm_source` + `furthest_stage`
for partition-pruning queries by channel + stage.

The mart is forward-compatible with the Phase 10d D3 `page_engagement`
event: the `demo_engagement_pings` count returns 0 today (no
`page_engagement` event_name flowing through `events_raw` until Phase
11 D9 wires the GTM trigger + GA4 tag) and naturally populates once
the upstream wiring lands. No retroactive mart edit needed.

### Contact-form conversion signal

**Existing coverage:** `form_start` fires on first field focus.
`form_field_focus` fires per field. `form_submit` fires on submit
with `form_success: boolean`. The contact form's `handleSubmit` calls
`trackFormSubmit('contact', true)` on success and `false` on
validation failure or transport error.

**Verdict:** covered. The conversion signal is the
`form_success === true` predicate on `form_submit` events with
`form_name === 'contact'`. No new event needed.

### Cross-event funnel reporting in Metabase

**Existing coverage:** `01_funnel_conversion_by_channel.yaml` already
ships a per-channel ecommerce funnel question reading
`mart_session_events`. It surfaces sessions / viewers / carters /
purchasers across UTM sources for the last 30 days.

**Gap:** no surface for the *aggregate* funnel drop-off across all
channels — only the per-channel breakdown.

**Closed by:** new question
`07_ecommerce_funnel_drop_off.yaml` reading the new
`mart_ecommerce_funnel`. Ordered bar chart with stages
`entered_demo → viewed_product → added_to_cart → reached_checkout →
purchased` and per-stage session counts. Reads the same 30-day
window as the channel-breakdown question for consistency.

## Carry-forwards (Phase 11 D9 reconciler scope)

The new `page_engagement` event is on the data layer (`window.dataLayer`
push) but the GTM trigger + GA4 tag pair is not yet wired in
`infrastructure/gtm/web-container.json`. This matches the
already-documented carry-forward pattern from Phase 10b D1c (`web_vital`)
+ Phase 10d D5 security review:

> Phase 11 D9 carry-forwards:
> - `web_vital` sGTM trigger + GA4 tag (10b D1c)
> - `page_engagement` sGTM trigger + GA4 tag (10d D3, NEW)
> - data-generator + sGTM Cloud Run runtime SA bindings (10d D5)
> - `bridgeToGtagConsent` ↔ web-container `consentSettings` parity test (10d D5)

The BigQuery raw-schema columns for `page_engagement` (`engagement_seconds`
INT64 + `max_scroll_pct` INT64) **are** landed in
`infrastructure/bigquery/schema.json` as part of the Pass-2 fix-pack,
mirroring the `web_vital` precedent's "schema lands with the event,
trigger lands later" sequencing. This avoids the silent-payload-drop
failure mode that would otherwise occur when Phase 11 D9 wires the
sGTM trigger against an `events_raw` table that doesn't have the
columns (sGTM's `ignoreUnknownValues: true` setting drops unknown
fields without erroring). Pinned by
`tests/integration/bigquery-schema.test.ts`.

Without the GTM wiring, `page_engagement` flows to `window.dataLayer`
+ the SSE pipeline (visible in the Session overlay's Timeline tab) but
does not reach `iampatterson_raw.events_raw` — so the
`mart_ecommerce_funnel.demo_engagement_pings` column is inert until
Phase 11 D9 lands. The mart is still useful for the funnel-stage
columns it already populates from existing event types.

## Schema state after D3

| Event | Phase | Surface | In `RENDERABLE_EVENT_NAMES`? |
| --- | --- | --- | --- |
| `page_view` | 1 | every route | yes |
| `scroll_depth` | 1 | 25/50/75/100 milestones | yes |
| `click_nav` | 1 | header + footer nav | yes |
| `click_cta` | 1 | every CTA | yes |
| `form_field_focus` | 1 | contact form | yes |
| `form_start` | 1 | contact form | yes |
| `form_submit` | 1 | contact form | yes |
| `consent_update` | 1 | Cookiebot listener | yes |
| `product_view` | 6 | ecommerce PDP | yes |
| `add_to_cart` | 6 | ecommerce PDP | yes |
| `remove_from_cart` | 9F | ecommerce cart | yes |
| `begin_checkout` | 6 | ecommerce checkout | yes |
| `purchase` | 6 | ecommerce confirmation | yes |
| `plan_select` | 6 | (subscription, removed in 9E) | hidden |
| `trial_signup` | 6 | (subscription, removed in 9E) | hidden |
| `form_complete` | 6 | (leadgen, removed in 9E) | hidden |
| `lead_qualify` | 6 | (leadgen, removed in 9E) | hidden |
| `nav_hint_shown` | 9E | nav-hint pre-show | yes |
| `nav_hint_dismissed` | 9E | nav-hint dismiss | yes |
| `session_pulse_hover` | 9E | SessionPulse hover (60s debounced) | yes |
| `overview_tab_view` | 9E | overlay Overview tab | yes |
| `timeline_tab_view` | 9E | overlay Timeline tab | yes |
| `consent_tab_view` | 9E | overlay Consent tab | yes |
| `portal_click` | 9E | overlay portals | yes |
| `coverage_milestone` | 9E | coverage threshold cross | yes |
| `web_vital` | 10b | `web-vitals` library | yes |
| `page_engagement` | 10d | every page (NEW) | yes |

27 distinct event types, 23 in `RENDERABLE_EVENT_NAMES` (4 sub/leadgen
hidden until those demos return).

## Out of scope (deliberately deferred)

- **Real ride-along of `page_engagement` into the overlay timeline.** The
  data-layer push happens; the SSE pipeline picks it up via existing
  `useEventStream` so the event appears in the overlay's Timeline tab
  with the same routing chips as any other event. No additional
  visualization needed.
- **Page-engagement-distribution Metabase question.** Once
  `page_engagement` flows to `events_raw` (Phase 11 D9), a question
  surfacing the time-on-page distribution per route is a natural
  follow-up. Not blocking for D3 close-out; the gap was the missing
  *event*, not the missing *visualization*.
- **Funnel-step instrumentation re-evaluation.** The 9F native-reveal
  rebuild already touches every funnel-stage component; D3 is the
  cross-cut analytics audit, not a re-implementation of the per-stage
  emissions which are already verified by their own test pins.
- **Subscription / leadgen-side analytics.** Both demos were removed in
  Phase 9E (`docs/UX_PIVOT_SPEC.md` §4); their event types stay in the
  schema for future reintroduction but no current surface emits them.
  D3 is scoped to surfaces that exist today.

## Test pins added in D3

`tests/unit/events/schema.test.ts`:
- Exhaustiveness Record gains `page_engagement: true` (drift catcher).
- New positive pin: `page_engagement` is in `DATA_LAYER_EVENT_NAMES` AND
  `RENDERABLE_EVENT_NAMES`.

`tests/unit/events/track.test.ts`:
- `trackPageEngagement` push shape pin (event name + threshold + scroll
  pct + base fields).
- Three-threshold round-trip pin (15 / 60 / 180 each carry through).

`tests/unit/components/page-engagement-tracker.test.tsx` (new file):
- Fires 15s threshold after 15s.
- Fires 15s + 60s + 180s thresholds in order, each at most once.
- `max_scroll_pct` captures unbucketed value at firing.
- `max_scroll_pct` preserves high-water-mark across scroll-back-up.
- Counter pauses on `document.hidden = true`, resumes on `false`.
- Hidden-from-start gates all firings.
- Pathname change resets fired-thresholds set (SPA navigation pin).
- Cleanup on unmount (interval + listeners).
- Renders nothing.

## Summary

| Sub-item | Status pre-D3 | D3 work |
| --- | --- | --- |
| Demo interaction patterns | Covered (Phase 6) | None |
| Time-on-site / scroll distribution | Gap: no time signal, milestone-bucket scroll only | New `page_engagement` event + tracker |
| Funnel reach into ecommerce | Events present, no mart | New `mart_ecommerce_funnel` Dataform model |
| Contact-form conversion | Covered (Phase 1) | None |
| Cross-event funnel reporting | Per-channel only, no aggregate drop-off | New Metabase question `07_ecommerce_funnel_drop_off.yaml` |

**Result:** all five sub-items the deliverable names are addressed.
The two gap closers — `page_engagement` event + tracker, and
`mart_ecommerce_funnel` + companion Metabase question — fit cleanly
into the existing schema, mart, and Metabase-as-code conventions.
