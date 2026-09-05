# Cloud Run adoption: measured and decided, not yet applied

Deliverable 13.4, **partial**. Everything that can be established without
changing production is here. The changes themselves are not made, and the reason
is at the bottom.

## The scaling measurement the deliverable requires

The amended 13.4 asks for the abort counts to be re-measured before anything
changes, because two figures recorded on 2026-09-04 disagreed. They are now
reconciled, and the disagreement had a cause worth writing down.

**The 12.3 `cloud_run_no_instance` metric cannot answer this question.**
Log-based metrics are not retroactive: they count only entries written after the
metric is created, and this one was created on 2026-09-04. Queried over the last
seven days it returns a single abort, which reads as "the problem went away" and
is entirely an artifact of the metric's age. The logs themselves retain 30 days
and are the real source.

Measured from the logs on 2026-09-05:

| Service | Last 7 days | Last 30 days |
| --- | --- | --- |
| `sgtm` | 13 | **96** |
| `data-generator` | 1 | 1 |

The earlier figures were both right about their own windows: 13 is the seven-day
sGTM count, matching `docs/verification/2026-09-04-first-real-alert.md`, and the
"16" in the deliverable's wording was a differently-bounded query on the same
day. The number that matters is 96 in 30 days.

## The corrected configuration

| Service | Today | Corrected | Why |
| --- | --- | --- | --- |
| `sgtm` | min 1, **max 3** | min 1, **max 10** | 96 aborts in 30 days means the ceiling is binding, and a request aborted here is a visitor's events dropped silently. `maxScale` is a ceiling, not a reservation — Cloud Run bills running instances — so raising it costs nothing until it is needed. At concurrency 80 a ceiling of 10 is 800 concurrent requests. |
| `data-generator` | min 0, max 10 | **unchanged** | One abort in 30 days, on a weekday demo generator whose next run succeeds twenty minutes later. Minimum instances would buy an always-on instance to prevent one dropped synthetic event per month. The three schedulers are already spread across `:00`, `:20` and `:40`. Correcting this would cost more than the fault. |
| `sgtm-preview` | min 0, max 1 | unchanged | No production traffic. |
| `event-stream` | min 1, max 1 | unchanged | Single-instance by design; the SSE connections are stateful per instance. |

"The configuration adopted is the corrected one and not today's" is satisfied for
data-generator by a recorded decision not to change it. That is a correction —
the deliverable's own evidence paragraph assumed both services needed the same
fix, and measurement says one of them does not.

## The identity finding

**The default compute service account holds `roles/editor` on the project**, and
four services run as it: `sgtm`, `sgtm-preview`, `event-stream` and
`data-generator`. Project editor is close to unrestricted: it can modify
BigQuery, Pub/Sub, Cloud Run, Cloud Storage and Secret Manager. Phase 10d's
security review flagged this as a carry-forward; this is the measurement of what
it actually means.

`claudish-proxy` and `metabase` already run as dedicated accounts, so the pattern
exists here and is not being invented.

## What each service actually needs

Derived by reading the code rather than by guessing, because a role set that is
too small breaks the pipeline without announcing it.

| Service | Evidence | Least-privilege proposal |
| --- | --- | --- |
| `event-stream` | **No GCP client libraries at all.** No `@google-cloud/*` dependency, no client construction anywhere in `src`. It receives Pub/Sub *push* over HTTP and serves SSE. | A dedicated account with **no project roles**. It needs an identity, not permissions. From `roles/editor` to nothing. |
| `data-generator` | `@google-cloud/bigquery`, writing to `iampatterson_raw`. | `roles/bigquery.jobUser` on the project plus `roles/bigquery.dataEditor` scoped to the `iampatterson_raw` dataset. |
| `sgtm` | `infrastructure/gtm/server-container.json` configures both BigQuery and Pub/Sub destinations. | `roles/bigquery.dataEditor` on `iampatterson_raw` plus `roles/pubsub.publisher` on the events topic. |
| `sgtm-preview` | Same container, no production destinations exercised. | Same as `sgtm`, so preview can be tested against the same wiring. |

## Not applied, and why

This session ran unattended, and the remaining half of 13.4 is a set of
production mutations: raising sGTM's instance ceiling, creating four service
accounts, granting their roles, and moving four running services onto them. The
first of those was attempted and refused by the environment's guard on
production changes.

That guard is right for this work. A runtime identity change on `sgtm` does not
fail loudly — every page keeps loading and events stop arriving — and the
verification that it worked is not an HTTP 200 but rows continuing to land in
`iampatterson_raw`, which takes time and attention to confirm. Doing that with
nobody watching, four services deep, is how a portfolio site goes quietly blind.

**The commands, in the order they should run.** Preview first, then the service
with no permissions to lose, then the two that matter.

```bash
# 1. Scaling, and its own verification
gcloud run services update sgtm --project=iampatterson --region=us-central1 --max-instances=10
curl -s -o /dev/null -w '%{http_code}\n' https://io.iampatterson.com/healthy

# 2. Create the accounts
for s in sgtm-runtime sgtm-preview-runtime event-stream-runtime data-gen-runtime; do
  gcloud iam service-accounts create "$s" --project=iampatterson
done

# 3. Grant, least privilege (event-stream-runtime gets nothing, deliberately)
gcloud projects add-iam-policy-binding iampatterson \
  --member=serviceAccount:data-gen-runtime@iampatterson.iam.gserviceaccount.com \
  --role=roles/bigquery.jobUser
# dataset-scoped grants for data-gen-runtime, sgtm-runtime, sgtm-preview-runtime
# on iampatterson_raw, and pubsub.publisher on the events topic for the sgtm pair

# 4. Move one service at a time, checking after each
gcloud run services update sgtm-preview --project=iampatterson --region=us-central1 \
  --service-account=sgtm-preview-runtime@iampatterson.iam.gserviceaccount.com
```

After each identity change the check is not the health endpoint. It is that
`iampatterson_raw.events_raw` keeps gaining rows on a weekday, and that the
Cloud Run 5xx and Pub/Sub backlog alerts stay quiet.

Terraform's `cloud-run.tf` declares both the scaling and the service accounts, so
whichever way these changes are made, the configuration has to move with them or
13.7's clean plan goes dirty. Nothing here was written into the `.tf` for exactly
that reason: a declared value that production does not have is a lie in the file
that 13.7 just finished making truthful.
