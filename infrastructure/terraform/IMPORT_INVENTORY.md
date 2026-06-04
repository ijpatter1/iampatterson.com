# Terraform Import Inventory — `iampatterson` GCP project

Live-resource census taken **2026-06-03** (Phase 11 D9 kickoff), used as the brownfield-import map. Modules 1-3 (foundation, Metabase LB/IAP, Cloud Run) imported through **2026-06-04**; see the per-module status in the build order at the bottom. Terraform adopts these existing resources via `import {}` blocks; the standing proof of completeness is a clean `terraform plan` no-op.

- **Project:** `iampatterson` · number `262727068689` · ACTIVE
- **Default region:** `us-central1` (all Cloud Run + Cloud SQL + Scheduler live here)
- **Remote state:** `gs://iampatterson-tfstate` (us-central1, versioned, UBLA) — created 2026-06-03, **not** self-managed by Terraform

## In-scope (Terraform-managed)

### Service accounts (user-created)
| account_id | display_name | notes |
|---|---|---|
| `metabase-runtime` | Metabase Cloud Run runtime | |
| `metabase-bigquery` | Metabase BigQuery reader | dataset-scoped read-only on marts |
| `data-gen-scheduler` | Cloud Scheduler → Data Generator | |
| `stape-sgtm` | stape-sgtm | legacy (sGTM now self-hosted on Cloud Run); managed as-is |
| `claude-code-sandbox` | Claude Code Sandbox | dev tooling SA |

### Project services (curated subset of 39 enabled APIs)
`run`, `sqladmin`, `sql-component`, `compute`, `pubsub`, `bigquery`, `secretmanager`, `cloudscheduler`, `iap`, `iam`, `iamcredentials`, `dataform`, `monitoring`, `logging`, `artifactregistry`, `serviceusage`, `cloudresourcemanager`, `servicenetworking` — all `.googleapis.com`. (`disable_on_destroy = false`.)

### Cloud Run (us-central1)
`data-generator`, `event-stream`, `metabase`, `sgtm`, `sgtm-preview` — URLs share the `eb4xrwmo3q-uc` revision suffix.

### Cloud SQL
`metabase-app-db` — Postgres 15, db-f1-micro, us-central1.

### Pub/Sub
- topic `iampatterson-events`
- push subscription `iampatterson-events-push` → `https://event-stream-…/pubsub/push`

### BigQuery datasets
`iampatterson_raw`, `iampatterson_staging`, `iampatterson_marts`, `iampatterson_assertions` (Dataform assertions).

### Metabase load-balancer topology (global external)
| kind | name |
|---|---|
| static IP | `metabase-lb-ip` (34.102.206.180, EXTERNAL global) |
| backend service (IAP) | `metabase-backend` (HTTP, EXTERNAL_MANAGED) |
| backend service (direct/non-IAP) | `metabase-backend-direct` (HTTP, EXTERNAL_MANAGED) |
| serverless NEG | `metabase-neg` (us-central1) |
| URL map | `metabase-url-map` (the `/app·/api·/embed` ↔ IAP split lives here) |
| target HTTPS proxy | `metabase-https-proxy` → url-map, cert `metabase-cert` |
| forwarding rule | `metabase-forwarding-rule` (34.102.206.180:443) |
| managed SSL cert | `metabase-cert` (ACTIVE, `bi.iampatterson.com`) |

### Cloud Scheduler (us-central1)
`data-gen-ecommerce` (`0 9-17 * * 1-5`), `data-gen-subscription` (`20 …`), `data-gen-leadgen` (`40 …`).

### Secret Manager (resource shells only — values stay out of state)
`dataform-github-token`, `metabase-api-key`, `metabase-bq-sa-key`, `metabase-db-password`, `metabase-embed-config`, `metabase-embedding-secret-key`, `metabase-encryption-key`, `metabase-iap-client-id`, `metabase-iap-client-secret`.

## Carve-outs / excluded

- **GTM + sGTM container config** — no Terraform provider; stays reconciler-driven (`infrastructure/gtm/`). The Cloud Run `sgtm` / `sgtm-preview` *services* are TF-managed; the container *config* is not.
- **`analytics_530123649`** BigQuery dataset — GA4 BigQuery export, Google-managed. Excluded.
- **Default compute SA** `262727068689-compute@` — Google-managed. Referenced for IAM if needed, not a `google_service_account` resource.
- **`iampatterson_cloudbuild` + `run-sources-iampatterson-us-central1`** buckets — auto-created by Cloud Build / Cloud Run source deploys. Excluded (or import read-only later if desired).
- **`iampatterson-tfstate`** — the state bucket; not self-managed.
- **Vercel frontend / Dataform model SQL** — separate pipelines (see ARCHITECTURE Phase 11 IaC section).

## Spec-vs-reality deltas (decide before those modules)

1. **Pub/Sub dead-letter topic + subscription — DOES NOT EXIST.** REQUIREMENTS D9 lists a DLQ. This would be net-new (`apply`), not an import. Decision: add it as a deliberate improvement, or drop from D9 scope.
2. **AI-export GCS bucket — DOES NOT EXIST.** Spec lists "AI-export bucket + lifecycle" (Phase 5 era). No such bucket is live. Decision: recreate as net-new, or remove from D9 scope as stale.
3. **`sgtm-preview` Cloud Run service** — not in the original prose; real and managed.
4. **`iampatterson_assertions` dataset** — 4th dataset beyond raw/staging/marts; Dataform output; managed.
5. **`stape-sgtm@` SA** — legacy naming from the Stape era; sGTM is now self-hosted. Managed as-is; rename is a separate change.

## Module build order (foundation-first)

1. **Foundation** ✅ 2026-06-03 — backend, providers, variables, project-services, service-accounts (23 resources).
2. **Metabase LB/IAP topology** ✅ 2026-06-04 — the highest-risk surface, the 9F `/app/*` drift family (8 resources).
3. **Cloud Run services (×5)** ✅ 2026-06-04 — service shells imported; deploy-volatile fields yielded via `ignore_changes`.
4. Cloud SQL.
5. Pub/Sub (+ DLQ decision).
6. BigQuery datasets.
7. Cloud Scheduler.
8. Secret Manager shells.
9. IAM bindings (cross-cutting; after principals + resources exist).
10. Monitoring / alerting / uptime (Phase 11 D1–D3) as those deliverables land.
