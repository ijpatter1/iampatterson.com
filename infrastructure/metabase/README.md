# Metabase Infrastructure

Self-hosted Metabase on GCP for iampatterson.com. Runbook and deployment
scripts for Phase 9B-infra. The full deployment spec — pinned versions,
naming conventions, evaluator checks, cost expectations — lives at
[`docs/input_artifacts/metabase-deployment-plan.md`](../../docs/input_artifacts/metabase-deployment-plan.md).

Scripts are sequenced and land task-by-task: do not jump ahead. Each task
is idempotent and safe to re-run.

## Prerequisites

- `gcloud` CLI authenticated: `gcloud auth login && gcloud config set project iampatterson`
- IAM roles on the executing principal:
  - `roles/cloudsql.admin` (Task 1)
  - `roles/secretmanager.admin` (Tasks 1–2, 6)
  - `roles/billing.viewer`, `roles/billing.projectManager` (Task 1 budget alert)
  - additional roles arrive with later tasks
- APIs enabled (Task 1): `sqladmin`, `secretmanager`, `servicenetworking`,
  `cloudbilling`, `billingbudgets`
- One-time VPC peering for Google-managed services on the `default` network.
  Required because Cloud SQL uses private IP only:

  ```bash
  gcloud compute addresses create google-managed-services-default \
    --global --purpose=VPC_PEERING --prefix-length=16 --network=default

  gcloud services vpc-peerings connect \
    --service=servicenetworking.googleapis.com \
    --ranges=google-managed-services-default --network=default
  ```

## Task 1 — Cloud SQL Postgres app DB

```bash
./setup-cloudsql.sh              # create resources
./setup-cloudsql.sh --dry-run    # print commands; no changes
```

Creates:

- Cloud SQL instance `metabase-app-db` — Postgres 15, `db-f1-micro`,
  `us-central1`, private IP only, daily backups (03:00 UTC, 7-day retention),
  point-in-time recovery enabled
- Database `metabase` inside the instance
- User `metabase` with a password generated via `openssl rand -base64 24`
- Secret Manager secret `metabase-db-password` holding the password
- Project-level budget alert at $100/month with thresholds at 50%, 90%, 100%
  (auto-discovers the linked billing account; skipped with a warning if none)

Expected baseline cost: ~$10/month for `db-f1-micro`.

**Verify:**

```bash
gcloud sql instances describe metabase-app-db \
  --format='value(settings.backupConfiguration.enabled,settings.backupConfiguration.pointInTimeRecoveryEnabled)'
# expect: True    True

gcloud secrets describe metabase-db-password
# expect: metadata incl. labels app=metabase, purpose=db-password

gcloud billing budgets list --billing-account=$(gcloud beta billing projects describe iampatterson --format='value(billingAccountName)' | sed 's|billingAccounts/||')
# expect: metabase-project-budget, 100 USD
```

**Retrieve the password** (for the Metabase UI Task 7 or for manual Cloud SQL
access):

```bash
gcloud secrets versions access latest --secret=metabase-db-password
```

## Upcoming tasks

Not yet implemented; scripts land per-task.

- Task 2 — Service accounts and IAM (`setup-iam.sh`)
- Task 3 — Cloud Run service deployment (`cloudrun.yaml`, `deploy.sh`)
- Task 4 — Environment variable documentation (`.env.example`)
- Task 5 — Load balancer + custom domain (`setup-domain.sh`)
- Task 6 — IAP configuration (`setup-iap.sh`)
- Task 7 — Metabase initial setup runbook (this README, expanded)
- Task 8 — Backup + upgrade runbooks (`backup.sh`, `upgrade.sh`)
