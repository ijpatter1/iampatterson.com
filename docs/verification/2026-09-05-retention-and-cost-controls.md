# Retention and cost controls

Deliverable 13.1. Measured first, then applied, then measured again. The
measurement is reproducible: `bash infrastructure/retention/apply.sh measure`.

## Before and after

| Surface | Before | After |
| --- | --- | --- |
| `iampatterson_raw.events_raw` partitions | 60 days | 60 days (confirmed) |
| `iampatterson_raw.ad_platform_raw` partitions | 60 days | 60 days (confirmed) |
| `iampatterson_staging` / `_marts` / `_assertions` | no expiration | no expiration (deliberate) |
| `gs://run-sources-iampatterson-us-central1` | no lifecycle rule | delete after 90 days |
| `gs://iampatterson_cloudbuild` | no lifecycle rule | delete after 90 days |
| `gs://iampatterson-tfstate` | no rule, versioning on | unchanged, deliberately |
| `_Default` log bucket | 30 days, marked provisional | 30 days, confirmed |
| `metabase-project-budget` | $200/month, **0 notification channels** | $200/month, notifies `ops-email` |
| Vertex spend budget for Claudish | none | none (decided against, below) |

Three things changed. Everything else was confirmed at the value it already had,
which is a result rather than an absence of one: the raw expiry was doing its job
and did not need touching.

## What the measurement found

**Storage is not a cost problem here.** 744.52 MiB across all four datasets
against a 10 GiB free tier. Retention on this project is hygiene and honesty
about how far the demo's history reaches, not savings. The three largest objects
are `events_raw` (272.3 MiB, 689,577 rows), `stg_events` (245.46 MiB) and
`mart_session_events` (177.67 MiB).

**The 60-day expiry is live and pruning.** `events_raw` ingestion partitions and
`stg_events.event_timestamp` both span 2026-07-07 to 2026-09-04 — 59 days. That
single fact answers the staging and marts question: they inherit the raw window
through the Dataform rebuild, so giving them their own expiry would be a second
control that could silently disagree with the first.

**Two buckets were growing without bound.** `run-sources-…` and
`iampatterson_cloudbuild` hold source archives written once per deploy and never
read again after the build that consumes them. Neither had a lifecycle rule.
Both now delete at 90 days, which outlives any rollback window a person would
use.

**The project budget could be crossed in silence.** `metabase-project-budget` has
existed since before Phase 12 at $200/month with thresholds at 50, 90 and 100 %
and **no notification channels at all**.

**The Dataform schedule is one config**, `production-config`, cron `0 4 * * *`
UTC, all targets.

## The AI export bucket does not exist

The deliverable asks for lifecycle rules on the AI export bucket.
`gs://iampatterson-ai-exports` is declared by
`infrastructure/bigquery/ai_access_layer/setup.sh` and the project has three
buckets, none of them that one. The setup script was written and never run.

Recorded rather than created. A bucket nothing writes to is not infrastructure,
and creating one to satisfy a checklist would leave a worse artifact than saying
plainly that the access layer never shipped.

## Two decisions worth their reasons

**The budget notifies email only.** Attaching both Phase 12 channels failed:
Cloud Billing budgets reject a pubsub-type monitoring channel with
`INVALID_ARGUMENT` (measured 2026-09-05; `gcloud` reports no detail, and the
cause was found by elimination). Budgets reach Pub/Sub through a separate
`notificationsRule.pubsubTopic` field instead, and that path is deliberately not
taken: budget messages carry a different schema from alert notifications, and the
only topic here is the one the monitoring rehearsals pull from with a parser that
expects alert JSON. Budget traffic would be consumed and acked by a reader that
cannot understand it.

**No separate Vertex budget for Claudish.** The deliverable makes it conditional
on the in-app cap not being enough, and it is enough. The proxy reserves and
reconciles token spend per request against `DAILY_BUDGET_USD` and trips itself to
cache-only when it crosses — a control that acts. A GCP budget only notifies, and
does so hours late. Project-level spend is now visible through the budget above.
`docs/manual/task-2026-08-31-002.md` is superseded and closed by this decision.

## What was deliberately not changed

Partition expiry is reported by `apply.sh apply`, never written by it. A script
that silently changes how long data lives is a script that can delete history as
a side effect of being run. Changing one of these values is a spec edit followed
by a deliberate command, not a consequence of reconciliation.

## Checks

| Check | Result |
| --- | --- |
| `apply.sh apply` run twice | second run reports `ok` on every item — idempotent |
| `apply.sh --dry-run apply` | reports the three changes, writes nothing |
| `infrastructure/monitoring/apply.sh --dry-run apply` | 29 unchanged, 0 create, 0 update — the retention status edit drifts nothing |
| Before/after diff | exactly the three intended changes, nothing else |
