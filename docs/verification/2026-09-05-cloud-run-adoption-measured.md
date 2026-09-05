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

## Applied, 2026-09-05, with permission given after the concern was raised twice

The first version of this record ended here, with the mutations unmade. Ian then
granted permission explicitly. What follows is what was actually done and how
each step was proved.

### Scaling

`sgtm` moved to `maxScale=10`, revision `sgtm-00015-kdj`, `io.iampatterson.com/healthy`
answering 200 throughout. `data-generator` deliberately unchanged.

### Identities

Four accounts created — `sgtm-runtime`, `sgtm-preview-runtime`,
`event-stream-runtime`, `data-gen-runtime` — and granted least privilege:

| Grant | Scope | Holder |
| --- | --- | --- |
| `WRITER` on `iampatterson_raw` | dataset | `sgtm-runtime`, `sgtm-preview-runtime`, `data-gen-runtime` |
| `roles/pubsub.publisher` | the `iampatterson-events` topic | `sgtm-runtime`, `sgtm-preview-runtime` |
| `roles/bigquery.jobUser` | project | `data-gen-runtime` |
| *(nothing)* | — | `event-stream-runtime`, by design |

The dataset grants matter more than they look. `iampatterson_raw` grants write
through the `projectWriters` special group, which is how a `roles/editor` account
reached it. Removing editor without adding explicit entries would have taken the
write path with it.

### Moved one at a time, each proved before the next

| # | Service | Proof |
| --- | --- | --- |
| 1 | `sgtm-preview` | health 200; no production traffic to lose |
| 2 | `event-stream` | health 200, and a probe published to the topic was accepted |
| 3 | `data-generator` | `/generate` invoked under the new identity: **712 events sent, 0 failed; 7 ad rows inserted, 0 failed**, and `events_raw` rose 689,577 → 690,289, exactly +712 |
| 4 | `sgtm` | `/generate` again after the move: **117 events, 0 failed**, and `events_raw` rose 690,289 → 690,406, exactly +117 |

Steps 3 and 4 are the ones that matter. A health endpoint cannot tell you an
identity change worked, because sGTM answers 200 whether or not it can still
write. Sending real events through and counting rows can.

**One trap worth recording.** `data-generator` had its traffic pinned to revision
`00008`. Updating its service account created revision `00010` and left traffic on
`00008`, so the service *spec* reported the new identity while the *serving
revision* still ran as the default compute account. It looked migrated and was
not. Traffic had to be routed explicitly. Any service with pinned traffic has this
failure mode, and `deploy-cloud-run.sh promote` pins traffic by design.

### Result

Six of six Cloud Run services now run on dedicated accounts. **Zero remain on the
default compute account.** Terraform's `cloud-run.tf` was updated to match, and
`terraform plan` returned to `No changes` afterwards.

## The import, applied

Run on 2026-09-05 after credentials were restored:

```
Apply complete! Resources: 6 imported, 0 added, 0 changed, 0 destroyed.
```

`claudish_proxy` and the four new runtime accounts are now declared in
`service-accounts.tf` and tracked in state, and `aiplatform.googleapis.com` is in
the curated services list — the spec-delta `IMPORT_PLAN.md` predicted, live-enabled
since the BigQuery Vertex connection and absent from the declared set.

State holds **52 resources**, up from 46, and `terraform plan` reports **`No
changes`**. 13.7's clean plan is restored, and this deliverable's "a plan run
shows no drift after import" is met against a real import rather than an
assertion.

## The abort count, after

| Window | sgtm | data-generator |
| --- | --- | --- |
| 30 days to 2026-09-05, before the change | 96 | 1 |
| 7 days to 2026-09-05, before | 13 | 1 |
| 12 hours after `maxScale` 3 → 10 | **0** | **0** |

Directionally right and not yet conclusive. Twelve hours is a short window and a
quiet one; the comparison worth making is another 30-day count against the 96.
That is a check for a later session, not a result this deliverable can claim.

## What remains outstanding

**The Secret Manager and IAM-member halves of `IMPORT_PLAN.md`** are not done.
They target modules 8 and 9, which do not exist in this Terraform root. The plan
itself notes the secret is unused break-glass holding no version and mounted by
nothing, to be imported for completeness or deleted deliberately — either way a
decision rather than a mechanical step, and neither is required by 13.4's
acceptance.

**`roles/editor` is still on the default compute service account.** No Cloud Run
service uses that identity any more, so the exposure this deliverable set out to
close is closed. Revoking the role itself is a separate change: Cloud Build and
other project machinery may still rely on it, and a project-wide role is not
something to remove without checking what breaks. It is the natural next
hardening step.

## Original reasoning, retained

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
