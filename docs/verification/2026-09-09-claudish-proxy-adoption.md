# Claudish proxy adopted; the identity layer declared

2026-09-09, session-2026-09-08-002, deliverable [14.5]. Closes the half of the
spec's section-10 workstream that [13.4] left undone.

## What was missing, and why nothing caught it

`google_cloud_run_v2_service.claudish_proxy` was absent from `cloud-run.tf` for
three months. [13.4]'s record said "the proxy adoption imported — 6 imported,
0 added, 0 changed, 0 destroyed", which was true of five service accounts and
`aiplatform.googleapis.com`, and not of the service.

`terraform plan` could not have reported it. **A resource in neither the
configuration nor the state produces no plan output at all** — the plan only
describes the gap between those two, so a clean plan was compatible with the
omission. The verification that was run ("did the plan converge") could not
discriminate the case it was taken as evidence for ("is the service declared").

The root also held **no IAM resources of any kind**, so every least-privilege
grant [13.4] created existed only in live IAM, undescribed and undetectable if
revoked.

## What now exists

```
Plan: 5 to import, 0 to add, 0 to change, 0 to destroy.
```

- `google_cloud_run_v2_service.claudish_proxy`, with `client`,
  `client_version`, `build_config`, the rolling image, **`template[0].containers[0].env`**
  and `traffic` in `ignore_changes`.
- Four `google_project_iam_member.runtime` entries: the proxy's
  `aiplatform.user`, `data-gen-runtime`'s `bigquery.jobUser`,
  `metabase-runtime`'s `cloudsql.client`, `metabase-bigquery`'s
  `bigquery.jobUser`.

The env exclusion is the point of the service resource, not a detail.
`KILL_SWITCH` lives in the service env; if Terraform owned that block an
emergency `gcloud run services update --update-env-vars KILL_SWITCH=on` would be
silently reverted by the next apply, mid-incident. `IMPORT_PLAN.md` called this
"the class of thing this plan exists to catch" and wrote it down in advance; it
is only now implemented.

`sgtm-runtime` and `event-stream-runtime` hold no project role, and `iam.tf`
says so explicitly. That absence is the least-privilege result [13.4] was after,
recorded so a future reader does not "fix" it by granting something.

## A correction the plan forced

The first hand-written resource block produced `1 to import, 0 to add, **1 to
change**`. It proposed to null out `execution_environment`, `cpu_idle`,
`startup_cpu_boost` and the service-level `scaling` block — every field the live
service has that a minimal declaration omits. The brownfield contract requires
an import to change nothing.

The body is therefore generated from live with
`terraform plan -generate-config-out` and the kill-switch `lifecycle` merged
onto it, which is what makes the plan a true no-op.

## The check that would have caught the original miss

`tests/unit/infrastructure/terraform-cloud-run.test.ts` now walks the service
directories under `infrastructure/cloud-run/` and asserts each has a
`google_cloud_run_v2_service` declaration. **It would have failed on
2026-09-03**, the day `claudish-proxy` entered the repository.

The census has to be current by construction. `IMPORT_INVENTORY.md` is dated
2026-06-03, three months before the service existed, so a pin against the
inventory would have been green throughout the miss — the same vacuous shape the
rest of this session kept finding. A source-deployed service cannot exist
without its directory, which is why the directory listing is the honest census.

## `roles/editor`: measured, and not revocable yet

All six Cloud Run services run as dedicated identities; the three schedulers use
`data-gen-scheduler`. Nothing *runs* as the default compute account.

**Cloud Build does.** Every source deploy — `event-stream`, `data-generator`,
`claudish-proxy`, including the 2026-09-08 generator deploy — builds under
`262727068689-compute@developer.gserviceaccount.com`. Revoking `roles/editor`
would break `gcloud run deploy --source` for three services.

Recommended and not done: narrow Cloud Build to `logging.logWriter`,
`artifactregistry.writer`, `run.developer` and source-bucket object access, or
give it a dedicated build account; verify a source deploy still succeeds; then
revoke. A production IAM change with a deploy-breaking failure mode is a
person's call made against a rehearsal.

## Open

**Not applied.** The five imports are declared and planned; `terraform apply` is
refused by the auto-mode classifier as an unattended production write and waits
on a person. Until it runs, the resources are declared and unmanaged — the state
they were already in, so nothing is worse, and the captured plan is the evidence
the import is a no-op.

**Dataset-level grants remain undeclared.** [13.4] added `WRITER` access entries
on the BigQuery datasets for three accounts. Declaring them means
`google_bigquery_dataset_access` resources alongside the existing dataset
declarations — a separate change with its own import surface, named here rather
than half-done.

**The break-glass secret decision is deferred with a reason.**
`claudish-anthropic-api-key` predates the WIF switch, holds no version and is
mounted by nothing. Recommendation: import rather than delete — an unused secret
costs nothing, deletion is irreversible, and importing puts its emptiness on the
record. Not done because verifying its live state needs `gcloud secrets`, which
was outside this session's permission set with the operator offline.
