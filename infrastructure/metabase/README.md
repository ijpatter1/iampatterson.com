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
  `cloudbilling`, `billingbudgets`. Verify before running:
  ```bash
  gcloud services list --enabled \
    --filter="config.name:(sqladmin OR secretmanager OR servicenetworking OR cloudbilling OR billingbudgets)" \
    --format="value(config.name)"
  ```
  Enable any missing: `gcloud services enable <name>.googleapis.com`
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

**Known limitations (tech debt, not blocking):**

- Secret and Cloud SQL user are created in one branch. If the secret exists
  but the user was deleted or a prior run failed between the two steps,
  re-running skips both. Recovery is manual via
  `gcloud sql users create --password=<from-secret>`. A future refinement
  would split them into independent idempotency gates.
- `gcloud sql users create --password=...` is briefly visible in the host's
  process list. Acceptable on a single-user workstation; future hardening
  could switch to `gcloud sql users set-password --password-file=-`.

## Task 2 — Service accounts and IAM

```bash
./setup-iam.sh              # create SAs, secrets, and IAM bindings
./setup-iam.sh --dry-run    # print commands; no changes
```

Prerequisite: Task 1 has run (the script refuses to continue if
`metabase-db-password` does not exist in Secret Manager).

Creates two service accounts with minimum-necessary permissions:

- `metabase-runtime@iampatterson.iam.gserviceaccount.com` — Cloud Run
  runtime identity.
  - `roles/cloudsql.client` (project level)
  - `roles/secretmanager.secretAccessor` **scoped to** the three Metabase
    secrets (`metabase-db-password`, `metabase-encryption-key`,
    `metabase-bq-sa-key`). Never granted project-wide.
- `metabase-bigquery@iampatterson.iam.gserviceaccount.com` — Metabase's
  BigQuery query identity.
  - `roles/bigquery.dataViewer` **scoped to** the `iampatterson_marts`
    dataset only (not project-wide).
  - `roles/bigquery.jobUser` at project level (BigQuery requires this
    role to submit any query; it cannot be dataset-scoped).

Creates two additional Secret Manager secrets:

- **`metabase-encryption-key`** — random 32 bytes (`openssl rand -base64 32`).
  Decrypts credentials stored in the Metabase app DB (notably the BigQuery
  SA key once Metabase saves it internally). **DO NOT REGENERATE.** Losing
  this key invalidates the app DB's encrypted rows and Metabase will lose
  its BigQuery connection config. The script generates this secret exactly
  once and skips regeneration on subsequent runs.
- **`metabase-bq-sa-key`** — JSON key for the `metabase-bigquery` service
  account. Generated to a `mktemp` path, uploaded to Secret Manager, then
  `shred`ed (falling back to `rm -f`). The script verifies the local file
  is absent before returning, and traps crashes to guarantee cleanup.

**Verify:**

```bash
gcloud iam service-accounts list --filter='email:metabase-*' --format='value(email)'
# expect: two lines — metabase-runtime and metabase-bigquery

gcloud secrets list --filter='name:metabase-*' --format='value(name)'
# expect: three lines — metabase-db-password, metabase-encryption-key, metabase-bq-sa-key

gcloud secrets get-iam-policy metabase-db-password --format='value(bindings.members)'
# expect: serviceAccount:metabase-runtime@...

bq show --format=prettyjson iampatterson:iampatterson_marts \
  | jq '.access[] | select((.userByEmail // .iamMember // "") | test("metabase"))'
# expect: one entry — roles/bigquery.dataViewer for metabase-bigquery

gcloud projects get-iam-policy iampatterson \
  --flatten='bindings[].members' \
  --filter='bindings.members:metabase-*' \
  --format='value(bindings.role,bindings.members)'
# expect: cloudsql.client for metabase-runtime; bigquery.jobUser for metabase-bigquery

ls -la *.json
# expect: no *-bigquery*.json or keyfile.json — the BQ SA key is only in Secret Manager
```

**Retrieve the BigQuery SA key** (for Task 7 Metabase UI data-source setup):

```bash
gcloud secrets versions access latest --secret=metabase-bq-sa-key
```

## Upcoming tasks

Not yet implemented; scripts land per-task.

- Task 3 — Cloud Run service deployment (`cloudrun.yaml`, `deploy.sh`)
- Task 4 — Environment variable documentation (`.env.example`)
- Task 5 — Load balancer + custom domain (`setup-domain.sh`)
- Task 6 — IAP configuration (`setup-iap.sh`)
- Task 7 — Metabase initial setup runbook (this README, expanded)
- Task 8 — Backup + upgrade runbooks (`backup.sh`, `upgrade.sh`)
