# web_vital and page_engagement, wired and landing

2026-09-09, session-2026-09-08-002, deliverable [14.4]. Published as container
version 10, "14.4 — web_vital and page_engagement wiring".

## The gap, measured before the fix

Both events have been in `DATA_LAYER_EVENT_NAMES` since Phases 10b and 10d,
`schema.test.ts` has asserted them for as long, and `schema.json` declared all
seven of their columns. The container had no trigger and no tag for either.

Hours before this landed, a production session with analytics consent granted
fired six `web_vital` and two `page_engagement` events. `events_raw` received
none of them. `web_vital` is deliberately rendered as a coverage chip on the
Overview tab, so the overlay had been showing visitors a chip for an event the
pipeline did not carry.

## What was applied

Eleven additions, nothing changed and nothing removed: seven data layer
variables, two `customEvent` triggers, two GA4 tags. Both tags require
`analytics_storage`, like every other GA4 event tag since version 9. A dry run
after publishing reports no drift.

The sGTM container needed no route change — `clientName - GA4` forwards every
GA4-client event generically to GA4, BigQuery and Pub/Sub. The deliverable
confirmed that rather than building it, which is what its amended wording asked
for.

## The acceptance, with payloads

| Event | Payload | Consent |
| --- | --- | --- |
| `web_vital` LCP | 128.0, good, reload | granted |
| `web_vital` TTFB | 30.2, good, reload | granted |
| `web_vital` FCP | 128.0, good, reload | granted |
| `web_vital` CLS | 0.000272, good, navigate | granted |
| `web_vital` INP | 40.0, good, navigate | granted |
| `page_engagement` | 60s threshold, 88% max scroll | granted |
| `page_engagement` | 15s threshold, 0% max scroll | granted |

All five Core Web Vitals with real values, ratings and navigation types. Both
engagement thresholds with the unbucketed high-water-mark scroll percentage
that `scroll_depth`'s milestone buckets cannot express.

## Two things verifying this exposed

**Web Vitals race the consent bridge, and it matters.** LCP, FCP and TTFB
resolve very early in page load; the consent bridge runs on React mount with
`wait_for_update: 500` as the grace window. In the first session every
`web_vital` fired before `consent_update` and was correctly blocked. On a
reload — the returning-visitor path, where consent comes from the stored
`CookieConsent` cookie rather than a banner answer — `web_vital` fired one
second after the bridge and landed. So the wiring works, but a first-time
visitor's Web Vitals are lost to their own consent decision, which is the
correct outcome and worth knowing rather than discovering later as a volume
anomaly.

**`schema.json` had never been applied.** The first `page_engagement` to land,
at 03:12:28, carries every parameter NULL. `infrastructure/bigquery/setup.sh`
created the table from the schema and skipped when it already existed, so the
live table had 50 columns against 77 declared and BigQuery silently discarded
every field without one. Fixed in the same session by making the script
reconcile additively; the rows above are from after that. The contrast between
the 03:12:28 row and the 03:21:55 rows is the whole finding in one table.
