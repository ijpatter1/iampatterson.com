# claudish-proxy — Terraform import plan (for Phase 11 D9)

Project `iampatterson` (262727068689), region `us-central1`. Provisioned
gcloud-first on `feat/claudish` (2026-08-31) because D9 was mid-import
on its own branch; this file is what D9 adopts, in the
IMPORT_INVENTORY.md voice. Add a one-line pointer in the inventory after
D9 merges — do not edit the inventory from this branch.

## The kill-switch trap (read first)

`KILL_SWITCH` lives in the service's env. If Terraform owns
`template[0].containers[0].env` without excluding it, an emergency
`gcloud run services update --update-env-vars KILL_SWITCH=on` is
silently reverted by the next `terraform apply` — mid-incident.
**Decision: add the env block (or the KILL_SWITCH entry) to
`ignore_changes`.** This is the class of thing this plan exists to catch.

## Resources to import

| Resource | Import ID | Destination |
|---|---|---|
| `google_service_account.managed["claudish_proxy"]` | `projects/iampatterson/serviceAccounts/claudish-proxy@iampatterson.iam.gserviceaccount.com` | `service-accounts.tf` (add to the locals map; the existing for_each import block picks it up) |
| `google_project_service.enabled["aiplatform.googleapis.com"]` | `iampatterson/aiplatform.googleapis.com` | `project-services.tf` (spec-delta: live-enabled since the BQ vertex connection, absent from the curated list) |
| `google_secret_manager_secret.claudish_anthropic_api_key` | `projects/iampatterson/secrets/claudish-anthropic-api-key` | Secret Manager module (module 8). **Unused break-glass**: created before the 2026-08-31 WIF switch, holds no version, nothing mounts it. Import for state completeness or delete deliberately — do not wire it back into the service. |
| `google_project_iam_member.claudish_proxy_aiplatform` | `iampatterson roles/aiplatform.user serviceAccount:claudish-proxy@iampatterson.iam.gserviceaccount.com` | IAM module (module 9) |
| `google_cloud_run_v2_service.claudish_proxy` | `projects/iampatterson/locations/us-central1/services/claudish-proxy` | `cloud-run.tf` |

## Cloud Run shell (what Terraform owns)

Source-deploy service — `ignore_changes` matches the existing
source-deploy set PLUS the kill switch:

```hcl
lifecycle {
  ignore_changes = [
    client,
    client_version,
    build_config,
    template[0].containers[0].image,
    template[0].containers[0].env, # KILL_SWITCH is an emergency control — see trap above
  ]
}
```

Durable shell to encode: `deletion_protection = true`,
`ingress = "INGRESS_TRAFFIC_ALL"`, `launch_stage = "GA"`,
service_account `claudish-proxy@`, scaling `min 1 / max 4`,
concurrency 80, cpu 1 / 512Mi, `timeout = "60s"` (NOT event-stream's
3600s — translations are short; 60s bounds a hung upstream),
gen2, port 8080 http1. No secret refs: the Anthropic lane
authenticates via Workload Identity Federation — the four
`ANTHROPIC_*` env vars are plain identifiers (rule, org, service
account, workspace), not credentials.

## Deltas / decisions for D9

1. `aiplatform.googleapis.com` — live but missing from
   `project-services.tf`'s curated list. Import, don't create.
2. The runtime SA follows the `<purpose>-<role>` convention and is NOT
   the default compute SA (closes the security-review carry-forward for
   this service; event-stream/data-generator remain open).
3. Test pins: add `claudish_proxy` to the `SERVICES` + `SOURCE_DEPLOY`
   arrays in `tests/unit/infrastructure/terraform-cloud-run.test.ts`
   when the TF lands, plus an ignore_changes pin covering the env entry.

## Verification

Same standard as the inventory: after import, `terraform plan` must be
a no-op. A planned destroy of the live service is a release blocker,
not a convergence step.
