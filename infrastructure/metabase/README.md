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
  - `roles/iam.serviceAccountAdmin`, `roles/iam.serviceAccountKeyAdmin` (Task 2)
  - `roles/resourcemanager.projectIamAdmin` (Task 2 project-level bindings)
  - `roles/bigquery.dataOwner` on `iampatterson_marts` (Task 2 dataset GRANT)
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

gcloud secrets list --filter='labels.app=metabase' --format='value(name)'
# expect: three lines — metabase-db-password, metabase-encryption-key, metabase-bq-sa-key

gcloud secrets get-iam-policy metabase-db-password --format='value(bindings.members)'
# expect: serviceAccount:metabase-runtime@...

bq show --format=prettyjson iampatterson:iampatterson_marts \
  | jq '.access[] | select((.userByEmail // .iamMember // "") | test("metabase"))'
# expect: one entry — roles/bigquery.dataViewer for metabase-bigquery

gcloud projects get-iam-policy iampatterson \
  --flatten='bindings[].members' \
  --filter='bindings.members~metabase' \
  --format='value(bindings.role,bindings.members)'
# expect: roles/cloudsql.client for metabase-runtime;
#         roles/bigquery.jobUser for metabase-bigquery

ls -la *.json
# expect: no *-bigquery*.json or keyfile.json — the BQ SA key is only in Secret Manager
```

**Retrieve the BigQuery SA key** (for Task 7 Metabase UI data-source setup):

```bash
gcloud secrets versions access latest --secret=metabase-bq-sa-key
```

## Task 3 — Cloud Run service deployment

Deploys Metabase to Cloud Run gen2, reachable only via the Task 5 load
balancer (ingress locked to `internal-and-cloud-load-balancing`).

```bash
# The plan pins to metabase/metabase:v0.59.6.x — resolve the patch
# (check https://github.com/metabase/metabase/releases) and export before
# running. The script refuses to deploy the '.x' placeholder.
export METABASE_IMAGE=metabase/metabase:v0.59.6

./deploy.sh              # render cloudrun.yaml + apply
./deploy.sh --dry-run    # render + cat the spec; do not apply
```

Files:

- `cloudrun.yaml` — templated Knative service spec. Placeholders (`${...}`)
  are resolved by `deploy.sh`. Sizing, scaling, timeouts, and env var
  sources are pinned in the file; edit the file to change sizing.
- `deploy.sh` — renders the template (envsubst with sed fallback), checks
  preconditions, applies via `gcloud run services replace`.

Resources and behavior:

- Image: `metabase/metabase:<pinned-tag>` — never `:latest`.
- Sizing: 2Gi memory, 1 CPU, concurrency 10, timeout 300s, gen2.
- Scaling: `minScale=1` (warm), `maxScale=3`. Cold start takes ~60–120s.
- Service account: `metabase-runtime@iampatterson...`.
- Cloud SQL: Auth Proxy sidecar via `run.googleapis.com/cloudsql-instances`;
  Unix socket mounted at `/cloudsql/iampatterson:us-central1:metabase-app-db`.
- Networking: Direct VPC egress (gen2) with `private-ranges-only` so the
  Auth Proxy can reach the Cloud SQL instance on its private IP.
- Env: `MB_DB_TYPE=postgres` set explicitly (prevents fallback to embedded
  H2). `MB_DB_PASS` and `MB_ENCRYPTION_SECRET_KEY` sourced via
  Secret Manager `valueFrom.secretKeyRef` (no secrets in the yaml).
- Health: `startupProbe` on `/api/health`, 30s initial delay, 10s period,
  12 failures (~120s) before Cloud Run gives up.

**Verify:**

```bash
gcloud run services describe metabase \
  --region=us-central1 --project=iampatterson \
  --format='value(status.url,status.conditions[0].status,spec.template.spec.containers[0].image)'
# expect: <run.app URL>, True, metabase/metabase:<pinned-tag>

URL=$(gcloud run services describe metabase \
  --region=us-central1 --project=iampatterson --format='value(status.url)')
curl -sI "${URL}/api/health" | head -1
# expect: 404 / 403 / connection refused — ingress blocks .run.app direct access.
# Only the LB from Task 5 can reach the service.
```

**Drift warning:** `gcloud run services replace` applies the *full* spec
from `cloudrun.yaml` on every run. Any manual edits made in the Cloud
Run console between deploys (extra env vars, scaling tweaks, traffic
splits) will be wiped. Change `cloudrun.yaml` and re-run, don't click.

**If deploy fails on the first attempt:** the most likely causes are:

- (a) `servicenetworking` / VPC peering not reachable from the Cloud Run
  service (Task 1 prerequisite).
- (b) `compute.googleapis.com` API not enabled — required for Direct
  VPC egress on gen2.
- (c) Permission gap — the executing principal needs
  `roles/iam.serviceAccountUser` on `metabase-runtime` to deploy a
  service that runs as that SA.
- (d) `metabase-runtime` missing `roles/secretmanager.secretAccessor` on
  `metabase-db-password` or `metabase-encryption-key` (Task 2's concern,
  but container startup will crash if either binding is wrong).
- (e) Cold start exceeds the 120s startup-probe budget (initial 30s +
  12 × 10s). Re-run and Cloud Run retries; if consistently over 120s,
  bump `failureThreshold` in `cloudrun.yaml`.

## Task 4 — Environment variable reference

`.env.example` documents every environment variable the Metabase
container receives from `cloudrun.yaml`, what it does, and where the
value comes from. **No real secret values** are in the file — secret
entries have empty RHS values and a `Source: Secret Manager (...)` line
pointing at the Secret Manager secret that actually holds the value.

Use it as a reference when rebuilding the deployment from scratch,
or copy it locally when running Metabase on a laptop (fill values
yourself; don't commit a filled copy).

Key entries to read before changing anything:

- **`MB_DB_TYPE=postgres`** — explicit, prevents silent fallback to
  the embedded H2 database.
- **`MB_ENCRYPTION_SECRET_KEY`** — the DO NOT REGENERATE secret.
  Rotating breaks every encrypted row in the app DB.

## Task 5 — Load balancer + custom domain

External HTTPS load balancer in front of Cloud Run, with a
Google-managed SSL cert for `bi.iampatterson.com`. The LB is a hard
prerequisite for Task 6 — IAP on Cloud Run works only through a
load-balancer-fronted backend service, not the direct `.run.app` URL.

```bash
./setup-domain.sh              # provision + print DNS + poll cert
./setup-domain.sh --dry-run    # preview
./setup-domain.sh --no-wait    # provision + print DNS; skip cert poll
```

Seven components created, each name-pinned for idempotent re-runs:

1. **Static IP** `metabase-lb-ip` (global)
2. **SSL cert** `metabase-cert` — Google-managed, for `bi.iampatterson.com`
3. **Serverless NEG** `metabase-neg` targeting the Cloud Run service
4. **Backend service** `metabase-backend` — IAP attaches here in Task 6
5. **URL map** `metabase-url-map` — `/` → backend service
6. **Target HTTPS proxy** `metabase-https-proxy` — binds URL map to cert
7. **Global forwarding rule** `metabase-forwarding-rule` — static IP:443 → proxy

**The manual step:** after components 1–7 are up, the script prints the
static IP and an exact DNS A record. Create that record at your domain
registrar. Google-managed certs will not provision until DNS resolves.

The script then polls cert status every 30 seconds for up to 60 minutes.
Cert provisioning typically takes 15–60 minutes once DNS is live. If the
script is interrupted, re-run it — steps 1–7 skip and polling resumes.

**Verify once cert is ACTIVE:**

```bash
curl -sI https://bi.iampatterson.com/api/health | head -3
# expect: HTTP/2 200 (after Task 6 attaches IAP, this becomes a 302
# redirect to accounts.google.com).

URL=$(gcloud run services describe metabase \
  --region=us-central1 --project=iampatterson --format='value(status.url)')
curl -sI "${URL}/api/health" | head -1
# expect: 404/403 — .run.app stays locked (ingress=internal-and-cloud-load-balancing).
```

**Failure modes:**

- Cert stuck `PROVISIONING` >60 min: check DNS resolution
  (`dig bi.iampatterson.com +short` should return the static IP), give
  it more time, or re-run to keep polling.
- Cert `FAILED_NOT_VISIBLE`: Google couldn't reach the domain. DNS not
  set or propagating. Verify the A record and re-run.
- Backend service shows no healthy endpoints: the serverless NEG isn't
  routable — confirm the Cloud Run service is reachable from the LB
  project (normally automatic when both are in the same project).

## Upcoming tasks

Not yet implemented; scripts land per-task.
- Task 4 — Environment variable documentation (`.env.example`)
- Task 5 — Load balancer + custom domain (`setup-domain.sh`)
- Task 6 — IAP configuration (`setup-iap.sh`)
- Task 7 — Metabase initial setup runbook (this README, expanded)
- Task 8 — Backup + upgrade runbooks (`backup.sh`, `upgrade.sh`)
