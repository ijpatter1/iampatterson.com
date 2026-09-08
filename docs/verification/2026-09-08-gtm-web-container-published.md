# GTM web container reconciled and published

2026-09-08, session-2026-09-08-002, deliverable [14.1]. Container
`GTM-MWHFMTZN` (`247511905`), account `6346433751`.

Applied and published by `infrastructure/gtm/reconcile.js`, which replaces the
one-shot scripts. Nothing was done by hand in the GTM interface.

## What was published

Version **9**, named `14.1 — Claudish wiring + analytics_storage gating`.
Read back from the API after publishing rather than taken from the publish
response:

| | Live version 9 |
| --- | --- |
| tags | 22 |
| triggers | 21 |
| variables | 56 |
| tags requiring `analytics_storage` | **21** |
| exempt | `GA4 - consent_update` only |
| Claudish tags | all four present |
| `gaawe` tags missing the shared settings variable | none |

Three changes, in the order they were decided:

1. **The four Claudish pipelines.** Four tags, four triggers and sixteen data
   layer variables that `deploy-claudish.js` authored, that the committed spec
   claimed were live, and that were never applied. `/claudish` has been firing
   these into the data layer since launch with nothing downstream to receive
   them.
2. **Consent gating on 21 of 22 tags.** The spec has declared
   `analytics_storage: required` since Phase 1; the container carried
   `notNeeded` on every tag throughout. A visitor who declines analytics now
   fires no GA4 tag and generates no cookieless ping. `GA4 - consent_update`
   stays exempt so the consent decision itself is still recorded, which means
   decliners go to one ping rather than zero.
3. **The shared event settings variable and `measurementId`** adopted into the
   spec from live, not applied against it — live had the better design and the
   spec was stale.

## How it was verified

**A dry run after the publish reports no drift.** Publishing consumes its
workspace and GTM creates a fresh "Default Workspace" with a new id — the trap
`deploy-phase6.js` documents at its top, where a hard-coded id had already gone
stale once. The reconciler resolves the workspace by name, so the post-publish
run needed no adjustment.

**The staged state was inspected before publishing, and the review gate ran
against it.** That ordering was the point: two instruments, both returning
do-not-publish, on work that was staged and reversible rather than live.

## What the gate caught, before the publish

The platform review returned 14 findings, the alignment review 11. Three would
have shipped a defect:

**The four Claudish tags were staged without `eventSettingsVariable`.** The
merge protects existing tags; a creation has nothing to merge from, and the
diff deliberately cannot see a field the spec never declares — so no dry run
could ever have reported it. The consequence, which the alignment review traced
and the platform review did not: `pubsub-tag-template.js:43` discards any event
lacking `iap_source`, which that variable supplies. All four pipelines would
have been dropped at sGTM while BigQuery collected rows with null sessions —
and the acceptance clause "queryable in `events_raw`" **would have passed on
unjoinable data**. This is the same defect [14.1] exists to fix, staged fresh.

**`consentSettings` was written outside the merge**, so a spec silent about
consent silently downgraded a live tag to `notNeeded`, with the diff never
comparing the field. On a site whose subject is consent-correct measurement,
that was the worst available failure mode.

**The overlay would have lied to declining visitors.** `buildRouting` hardcoded
`ga4`, `bigquery` and `pubsub` as `sent`. Honest while the container required no
consent of its own; false the moment this publish landed. Fixed in the same
deliverable, along with a timeline empty state that stops telling a decliner to
interact harder with a page that is correctly sending nothing.

## Open

**The acceptance clause is not yet met.** `claudish_translate`,
`claudish_detected`, `claudish_share` and `claudish_rate` must be queryable in
`iampatterson_raw.events_raw`, and as of the publish they return zero rows over
both the preceding fourteen days and the minutes since — the pipeline is wired
but no one has visited `/claudish` yet. The clause needs real traffic and is
open until it returns rows:

```sql
SELECT event_name, COUNT(*) n, MAX(_PARTITIONTIME) latest
FROM `iampatterson.iampatterson_raw.events_raw`
WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  AND event_name LIKE 'claudish%'
GROUP BY event_name
```

Note that a visitor must accept analytics for those rows to appear at all now,
which is the gate working rather than a fault.

**`useLiveEvents` still latches `sseEverDelivered`** on the first SSE event, so
a decliner whose exempt `consent_update` tag reaches sGTM can see a timeline
that shows one event and then stops. The labels on that event are now honest, so
nothing false is asserted, but the latch has not been looked at.

**`eslint .` scans agent worktrees.** While a review agent's worktree exists
under `.claude/worktrees/`, the project lint reports its files, so "lint clean"
is an unreliable gate signal at exactly the moment a review is running. Worth an
ignore entry.
