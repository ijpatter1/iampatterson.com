# The Terraform state, reconciled

Deliverable 13.7. The plan is a no-op. **No `terraform apply` was run, and no
state was written** — the reconciliation was achieved entirely by writing
configuration that tells the truth about what is live.

## Before

```
Plan: 0 to add, 1 to change, 6 to destroy.
```

Six resources sat in state with no configuration describing them, so Terraform's
plan was to remove them:

| Resource | What it is |
| --- | --- |
| `google_bigquery_dataset.raw` `.staging` `.marts` `.assertions` | the entire warehouse |
| `google_pubsub_topic.events` | the event pipeline's topic |
| `google_pubsub_subscription.events_push` | the push subscription to event-stream |

They were imported on 2026-06-08 at 20:02 UTC by a session that never committed
their configuration. No `bigquery.tf` or `pubsub.tf` existed on any branch.

The one change was `google_cloud_run_v2_service.data_generator`: state and live
pin traffic to revision `data-generator-00008-n2r`; the configuration asked for
`TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST`.

## After

```
No changes. Your infrastructure matches the configuration.
```

## What was done, and what was deliberately not

**The six were recovered as configuration, not dropped from state.** Either would
have produced a clean plan. Removing them with `terraform state rm` would have
been faster and would have thrown away a second time the work that was already
lost once — and it would have left the warehouse and the event pipeline outside
the declarative layer, which is the opposite of what this phase is for. The new
`bigquery.tf` and `pubsub.tf` are written against the attributes read out of
state, at the resource addresses state already holds, so no import blocks are
needed and nothing is recreated.

**Nothing was applied.** A no-op plan is the goal, and a plan that is already a
no-op has nothing to apply. The reconciliation changed files in the repository
and not one resource in GCP.

**The traffic conflict was settled by exclusion, not by surrender.** `traffic` is
now in `ignore_changes` on all five Cloud Run services. `scripts/deploy-cloud-run.sh
promote` exists precisely to route traffic to one exact revision after its field
diff has been reviewed; a configuration asking for LATEST fights that on every
deploy, and an apply would silently undo the operator's choice of which revision
serves. Traffic routing belongs to the deploy scripts. Terraform owns the service
shell. This is the same treatment `IMPORT_PLAN.md` specifies for `KILL_SWITCH`,
one layer out.

## What the pins cover

`tests/unit/infrastructure/terraform-state-reconciliation.test.ts`, 17 tests.
Verified red before green: with the traffic exclusion removed and the two
recovered files replaced by placeholders, **15 of 17 fail**. The two that survive
are guards that were already true — the pre-existing source-deploy exclusions,
and the absence of a dead-letter policy.

The pins exist because deleting one of these resource blocks is not an ordinary
file edit. It re-arms a destroy plan against production, and that has to fail a
test rather than pass review as a tidy-up.

| Suite | Tests |
| --- | --- |
| `tests/unit/infrastructure/` | 5 suites, 65 tests (48 recovered by 13.6, 17 added here) |
| Root suite | 1,892 across 174 suites |

## Recorded, not fixed

The push subscription has **no dead-letter topic**. That is the live shape, and a
pin asserts its absence rather than hiding it. Adding one is a design decision
with a cost, not a cleanup, and 13.5's "event pipeline backlog" entry is where
its absence has to be explained: without a dead-letter topic, a poisoned message
has no recovery path beyond draining the backlog or waiting for it to age out.

Similarly, `iampatterson_raw` carries a 60-day table and partition expiry. This
deliverable records it; 13.1 decides whether 60 days is the right answer.

## Superseded in one respect by 13.4

The "No changes" plan above was true when this record was written and is
intentionally no longer true. 13.4 staged the `claudish-proxy` adoption into
`service-accounts.tf` and `project-services.tf`, so the plan now reads
`6 to import, 0 to add, 0 to change, 0 to destroy`.

That is import-only: no resource is created, changed or destroyed, and the
destroy set this record exists to have emptied is still empty. One
`terraform apply` returns the plan to clean. The distinction worth keeping is
between a plan that proposes to *destroy* production, which is what 13.7 fixed,
and a plan that proposes to *adopt* resources into state, which is what 13.4
staged.

## The standing hazard is closed

`terraform apply` against this configuration is now a no-op rather than a
destroy of the event pipeline. The workflow's `plan` and `apply` jobs remain
gated on `vars.GCP_WIF_PROVIDER != ''`, which 14.3 sets — but the safety no
longer depends on that gate being unset.
