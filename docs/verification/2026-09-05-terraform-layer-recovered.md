# The Terraform layer, recovered

Deliverable 13.6. What landed, what was checked, and the plan output that is
13.7's starting point. **Nothing was applied and no state was written.**

## What was recovered, and why it needed recovering

`phase/11-operational-readiness` (PR #56, opened 2026-06-04) built the declarative
layer over two days as Phase 11 deliverable 9, and was never merged. `main` went
silent for three months afterwards; when work resumed on 2026-08-31 it was on the
Claudish translator, and when this initiative was planned on 2026-09-04 it was
generated from a `main` whose tracker still read "Phase 11 — NOT STARTED". The
2026-09-03 infrastructure sweep looked at live GCP rather than at code, so the
layer was invisible from both directions at once.

`infrastructure/cloud-run/claudish-proxy/IMPORT_PLAN.md`, written 2026-08-31,
names `service-accounts.tf`, `project-services.tf` and `cloud-run.tf`. All three
are real. None of them were on `main`.

Merged here as a merge commit rather than a cherry-pick or a squash, so the
eleven original commits keep their provenance. The branch's edits to
`REQUIREMENTS.md`, `PHASE_STATUS.md` and `ARCHITECTURE.md` were the only
conflicts and were resolved to this branch's side: they describe a tracker
structure that was archived on 2026-09-04.

| | |
| --- | --- |
| Files added | 24 (13 `.tf`, 4 test suites, 1 workflow, README, IMPORT_INVENTORY, tfvars, lockfile, .gitignore) |
| Lines | +1,676 |
| Conflicts | 3, all documentation, all resolved to this branch |
| New dependency | `@cdktf/hcl2json` (devDependency; the suites parse HCL to JSON to assert on it) |

## Checks

| Check | Result |
| --- | --- |
| Root suite | **1,875 passed / 173 suites**, from 1,827 / 169 — exactly the 4 Terraform suites and their 48 tests, no regression |
| `terraform fmt -check -recursive` | clean |
| `terraform validate` | `Success! The configuration is valid.` |
| `npm run lint` | clean |
| `terraform apply` | **not run** |

## The baseline plan

Run read-only with `-lock=false` on 2026-09-05, authenticated with the CLI
account's access token (Application Default Credentials on this machine belong to
a different account and cannot read the state bucket).

```
Plan: 0 to add, 1 to change, 6 to destroy.
```

The state at `gs://iampatterson-tfstate/terraform/state` tracks **46 resources**;
the configuration declares **40**. The six extras are in state with no
configuration describing them, so Terraform's plan is to remove them:

- `google_bigquery_dataset.raw`, `.staging`, `.marts`, `.assertions`
- `google_pubsub_topic.events`
- `google_pubsub_subscription.events_push`

They were imported on **2026-06-08 at 20:02 UTC**, four days after the branch's
last commit and after PR #56 was already open, by a session that never committed
their configuration. No `bigquery.tf` or `pubsub.tf` exists on any branch in this
repository. The state file's version history is the only record that the work
happened.

The one change is `google_cloud_run_v2_service.data_generator`: state and live pin
traffic to revision `data-generator-00008-n2r`, while the configuration asks for
`TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST`. That is a structural conflict with
`scripts/deploy-cloud-run.sh promote`, which exists precisely to route traffic to
an exact revision.

State by type: 18 `project_service`, 5 `service_account`, 5 `cloud_run_v2_service`,
4 `bigquery_dataset`, 2 `compute_backend_service`, 1 each of `sql_database_instance`,
`sql_database`, `sql_user`, `pubsub_topic`, `pubsub_subscription`, `compute_url_map`,
`compute_target_https_proxy`, `compute_region_network_endpoint_group`,
`compute_managed_ssl_certificate`, `compute_global_forwarding_rule`,
`compute_global_address`, and one data source.

## The standing hazard, stated plainly

Until 13.7 lands, **`terraform apply` against this configuration would destroy the
Pub/Sub topic and push subscription outright**, which stops events reaching
event-stream and BigQuery. The four BigQuery datasets carry no
`delete_contents_on_destroy`, so the provider should refuse to drop non-empty
datasets — but that refusal arrives partway through a destroy set that begins with
Pub/Sub, so "it would fail safely" is not a claim this record makes.

The only reason this has been harmless since June is that the workflow's `plan`
and `apply` jobs are gated on `vars.GCP_WIF_PROVIDER != ''`, which is unset. The
safety came from the work being unfinished, not from a guard anyone designed.

## PR #56

Superseded by this merge. It should be **closed, not merged**: its code is here,
and its three document edits target a tracker structure that no longer exists.
Closing it is Ian's action.
