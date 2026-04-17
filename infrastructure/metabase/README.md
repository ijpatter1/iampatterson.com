# Metabase Infrastructure

Self-hosted Metabase on GCP for iampatterson.com. Runbook and deployment
scripts for Phase 9B-infra. The full deployment spec — pinned versions,
naming conventions, evaluator checks, cost expectations — lives at
[`docs/input_artifacts/metabase-deployment-plan.md`](../../docs/input_artifacts/metabase-deployment-plan.md).

Scripts are sequenced and land task-by-task: do not jump ahead. Each task
is idempotent and safe to re-run.

## Traffic path

```
User (browser)
  → bi.iampatterson.com
  → Google Load Balancer + IAP (Google SSO gate, allowlist)
  → Cloud Run (metabase/metabase, ingress=internal-and-cloud-load-balancing)
  → Cloud SQL Postgres (metabase-app-db, via Cloud SQL Auth Proxy, private IP)
  → BigQuery iampatterson_marts (dataset-scoped read-only SA key)
```

Three security layers, any one stops an attacker: IAP (SSO allowlist),
Metabase auth (password + 2FA), BigQuery IAM (dataset-scoped read-only).

## Prerequisites

- `gcloud` CLI authenticated: `gcloud auth login && gcloud config set project iampatterson`
- IAM roles on the executing principal:
  - `roles/cloudsql.admin` (Task 1)
  - `roles/secretmanager.admin` (Tasks 1–2, 6)
  - `roles/billing.viewer`, `roles/billing.projectManager` (Task 1 budget alert)
  - `roles/iam.serviceAccountAdmin`, `roles/iam.serviceAccountKeyAdmin` (Task 2)
  - `roles/resourcemanager.projectIamAdmin` (Task 2 project-level bindings)
  - `roles/bigquery.dataOwner` on `iampatterson_marts` (Task 2 dataset GRANT)
  - `roles/run.admin` (Task 3 Cloud Run deploy)
  - `roles/iam.serviceAccountUser` on `metabase-runtime` (Task 3 — deploy a service that runs as that SA)
  - `roles/compute.loadBalancerAdmin`, `roles/compute.networkAdmin` (Task 5 LB components)
  - `roles/iap.admin` (Task 6 IAP config and allowlist)
  - All of the above roll up naturally into `roles/owner` if the executing account is a project owner. Otherwise, grant each role individually.
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
- Cloud SQL connection: **TCP to the instance's private IP**. `deploy.sh`
  resolves the IP at render time via `gcloud sql instances describe` and
  injects it as `MB_DB_HOST`. No Auth Proxy sidecar: Metabase's bundled
  pgjdbc constructs the JDBC URL by appending `:PORT` to `MB_DB_HOST`, so
  a Unix socket path breaks the URL. TCP over the VPC peering is
  functionally equivalent for security (traffic never leaves the VPC) and
  matches what Metabase/Cloud SQL deployments use in practice.
- Networking: Direct VPC egress (gen2) with `private-ranges-only` — the
  Metabase container reaches the Cloud SQL private IP through the
  `google-managed-services-default` VPC peering established in the
  Prerequisites section above.
- Env: `MB_DB_TYPE=postgres` set explicitly (prevents fallback to embedded
  H2). `MB_JETTY_PORT=8080` aligns Metabase's listener with Cloud Run's
  injected `PORT` (Metabase does NOT auto-read `PORT`). `MB_DB_PASS` and
  `MB_ENCRYPTION_SECRET_KEY` sourced via Secret Manager
  `valueFrom.secretKeyRef` (no secrets in the yaml).
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
  service (Task 1 prerequisite). Symptom: container logs show
  `Connection refused` on the Cloud SQL private IP.
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
- (f) Cloud SQL private IP changed since last deploy (rare; happens if
  the instance was recreated). `deploy.sh` resolves it on every run, so
  re-running picks up the new value. Inspect the rendered spec to
  confirm the IP matches the current `gcloud sql instances describe`.

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

## Task 6 — IAP configuration

Gates the Metabase load balancer behind Google SSO, with an explicit
allowlist of Google accounts. IAP runs BEFORE Metabase's own login, so
the first layer of defense is already in place even if Metabase is
somehow exposed or misconfigured.

### One-time manual step (before running the script)

Configure the OAuth consent screen in the GCP Console. `gcloud` cannot
do this for Internal-user-type brands:

1. Open
   <https://console.cloud.google.com/apis/credentials/consent?project=iampatterson>
2. User Type: **Internal**
3. App name: `iampatterson BI`
4. Support email: your Google account
5. Scopes: defaults (email, profile, openid)
6. Save

After the consent screen is saved, the project has an OAuth brand that
`setup-iap.sh` can use.

### Then run the script

```bash
./setup-iap.sh              # configure IAP + reconcile allowlist
./setup-iap.sh --dry-run    # preview
```

What it does:

1. Creates an OAuth 2.0 client named `metabase-iap-client` (idempotent
   via displayName match — re-runs find the existing one).
2. Stores the OAuth client ID and secret in Secret Manager as
   `metabase-iap-client-id` and `metabase-iap-client-secret`. Neither
   value appears on the command line or in logs.
3. Enables IAP on the `metabase-backend` backend service, wired to the
   OAuth client.
4. Grants `roles/iap.httpsResourceAccessor` to each member of the
   `ALLOWLIST` array at the top of the script.

### Editing the allowlist

Open `setup-iap.sh`. The `ALLOWLIST` array is at the top, near line 50:

```bash
ALLOWLIST=(
  "user:ian@tunameltsmyheart.com"
  "user:newperson@example.com"   # add a line like this
)
```

Re-run the script. Additions land; existing members are left alone.

**Removal is deliberately manual.** If a member is removed from the
array and the script re-runs, they stay granted. This is by design —
a config that removes on drift would silently lock people out if a
line gets commented or removed accidentally. To revoke:

```bash
gcloud iap web remove-iam-policy-binding \
  --resource-type=backend-services --service=metabase-backend \
  --member="user:someone@example.com" \
  --role="roles/iap.httpsResourceAccessor" \
  --project=iampatterson
```

> **Plan fidelity:** the deployment plan contains two allowlist rules
> that look contradictory ("exactly those specified" vs "adds new
> members, does not remove"). Additive-only is the safer failure mode
> — accidental removal of an array line can't silently lock someone
> out. The two rules are equivalent under the intended usage pattern.

### Verify

```bash
curl -sI https://bi.iampatterson.com/ | head -3
# expect: HTTP/2 302, Location: https://accounts.google.com/...

gcloud compute backend-services describe metabase-backend \
  --global --project=iampatterson --format='value(iap.enabled)'
# expect: True

gcloud iap web get-iam-policy \
  --resource-type=backend-services --service=metabase-backend \
  --project=iampatterson --format='value(bindings.members)'
# expect: all ALLOWLIST members
```

Open `https://bi.iampatterson.com/` in a browser:
- An allowlisted Google account → Google login → Metabase login page
- An incognito / non-allowlisted account → "You don't have access"

## Task 7 — Metabase initial setup (manual)

The one task with no script. Metabase's first-run wizard and admin UI
cannot be driven from the command line reliably. This runbook is the
source of truth — someone rebuilding the deployment from scratch
should be able to follow it end to end.

### 1. Open the instance

Navigate to <https://bi.iampatterson.com/> in a browser. You'll be
redirected to `accounts.google.com` for the IAP gate. Log in with an
account on the `ALLOWLIST` from Task 6. You should land on Metabase's
first-run wizard.

If you get "You don't have access": the Google account isn't in the
IAP allowlist. Add it to `setup-iap.sh` and re-run, or grant ad-hoc
via the manual `gcloud iap web add-iam-policy-binding` command.

### 2. Create the admin account

Metabase prompts for a name, email, and password.

- Use a strong password (20+ characters, password manager generated).
- This admin identity lives in the Postgres app DB — it is **separate
  from** the IAP identity. IAP gates access to the Metabase login page;
  this password gates access inside Metabase.
- Save the credentials somewhere retrievable (password manager).

### 3. Skip "Add your data"

The wizard offers to add a data source immediately. Skip it. The
BigQuery data source is added in step 7 below with the proper service
account key from Secret Manager.

Finish the wizard.

### 4. Admin Settings → Authentication

1. Open **Admin settings** (top-right gear menu → Admin settings).
2. Navigate to **Authentication**.
3. Disable **Allow user signups**. Only the admin should provision
   Metabase accounts; IAP already controls who can reach the login page.
4. (Optional) Enable **Google Sign-In**. This lets allowlisted IAP
   users auto-provision Metabase accounts on their first visit,
   avoiding shared logins. If enabled, set the allowed email domain
   to `tunameltsmyheart.com` (or whichever you use).

### 5. Admin Settings → Public Sharing

Open **Admin settings → Public sharing**. Verify:

- **Enable Public Sharing**: OFF
- **Enable Embedding in other applications**: OFF

These are off by default in Metabase 0.59, but double-check after
every upgrade — they are the most common way a Metabase instance
accidentally leaks data.

### 6. Turn on 2FA for the admin account

Open **Admin settings → Authentication** and enable **Multi-factor
authentication**. Use an authenticator app (Authy, 1Password, Google
Authenticator). Save the recovery codes in a password manager.

IAP is the first layer, Metabase login is the second, 2FA is the
third — defense in depth. If IAP is ever misconfigured (e.g., an
allowlist addition by mistake), 2FA is the last barrier before
someone gets in.

### 7. Add the BigQuery data source

Open **Admin settings → Databases → Add database**.

- **Database type:** BigQuery
- **Display name:** `iampatterson marts`
- **Project ID:** `iampatterson`
- **Service account JSON:** paste the contents of the
  `metabase-bq-sa-key` secret. Retrieve it via:

  ```bash
  gcloud secrets versions access latest --secret=metabase-bq-sa-key
  ```

  The command prints the JSON to stdout. Copy it and paste into the
  Metabase form. Do not save the file anywhere — writing the key to
  disk creates a persistent copy of credential material that could
  survive the session and doesn't need to. The clipboard is fine
  because it's volatile; Metabase encrypts the pasted JSON with
  `MB_ENCRYPTION_SECRET_KEY` the moment you save the data source.

- **Dataset filter:** under the **Datasets** control, select
  `Inclusion` from the dropdown and enter `iampatterson_marts` in the
  comma-separated list field. Metabase will otherwise scan every
  dataset the SA can see; the BQ SA is already dataset-scoped from
  Task 2, but narrowing this keeps the schema-sync fast and the data
  model focused.

- **Advanced options:** leave defaults. Metabase will infer the schema
  automatically.

Save. Metabase kicks off a schema sync — expect a few minutes on the
first run.

### 8. Verify you can query

Wait for the schema sync to complete (the database page shows a spinner
while syncing). Then:

1. Click **+ New** (top-right) → **Question**.
2. **Pick your starting data**: `iampatterson marts` → `mart_campaign_performance`.
3. **Visualize**. Rows should come back within a few seconds.

If rows return, the full pipeline is working: IAP → Metabase →
BigQuery (via the dataset-scoped SA) → `iampatterson_marts` tables
from Phase 5. This is the Tier 3 demonstration surface that
Phase 9B deliverable 6 will embed into the ecommerce confirmation
under-the-hood view.

### Troubleshooting

- **BigQuery data source save fails with "Permission denied"** — the
  `metabase-bq-sa-key` content is stale or was generated before the
  dataViewer GRANT in Task 2. Re-run `setup-iam.sh` to regenerate the
  key and upload a new secret version, then re-enter in Metabase UI.
- **Schema sync hangs or skips tables** — check that the SA has both
  `roles/bigquery.dataViewer` on `iampatterson_marts` AND
  `roles/bigquery.jobUser` at project level. Either missing and queries
  fail silently.
- **Login succeeds but dashboards don't load** — the
  `MB_ENCRYPTION_SECRET_KEY` changed since setup. Decryption of the
  saved BigQuery connection fails. Recovery: re-enter the BigQuery
  connection in step 7 (Metabase will re-encrypt with the current key).
  If it keeps happening, the key is getting rotated by mistake — check
  `setup-iam.sh`'s encryption-key branch.
- **"Email domain not allowed" when signing in with Google** — Google
  Sign-In from step 4 has a domain restriction that doesn't include the
  user's address. Open **Admin settings → Authentication → Google
  Sign-In** and either add the domain to the allowed list or disable
  the restriction. Users can still log in with the admin password path
  while you sort this out.

## Task 8 — Backup, upgrade, and other operational runbooks

Scripts: `backup.sh`, `upgrade.sh`.

### Backup

**Automated daily backups** are configured on the Cloud SQL instance
itself (Task 1): 7-day retention, 03:00 UTC window. Nothing to run for
the daily ones.

**On-demand backup** before any state change you want rollback
coverage for:

```bash
./backup.sh              # create + print backup ID
./backup.sh --dry-run    # preview
```

The description records the currently-deployed Metabase image tag, so
each backup is associated with a specific app DB schema version.

### Restore

Restoring is a **destructive operation on the target instance** — the
instance stops, existing data is replaced, and all connected sessions
drop. Expect ~5 minutes of downtime. Usage:

```bash
gcloud sql backups list --instance=metabase-app-db --project=iampatterson
# pick the backup ID from the output

gcloud sql backups restore <BACKUP_ID> \
  --restore-instance=metabase-app-db --project=iampatterson
```

### Upgrade

```bash
./upgrade.sh v0.59.7               # back up, prompt, deploy, poll Ready
./upgrade.sh v0.59.7 --dry-run     # preview (prints each step but doesn't run)
./upgrade.sh v0.59.7 --skip-backup # dangerous — only if you just ran backup.sh
```

Flow:

1. Validate target version matches the pinned-semver pattern.
2. Record current image (for rollback).
3. Run `backup.sh` (unless `--skip-backup`).
4. Print the Metabase release notes URL and require explicit
   confirmation (`[y/N]`). Reads from `/dev/tty`, so piped input
   cannot bypass the prompt.
5. Re-run `deploy.sh` with `METABASE_IMAGE` set to the target tag.
6. Poll `gcloud run services describe` until the new revision reports
   `Ready=True` and the image tag matches the target (up to 5 min).
7. If Ready: print manual verification steps (login, dashboard load).
   If not Ready: print rollback commands with the exact prior image
   tag and backup ID.

### Rollback a bad upgrade

The previous image is still on Cloud Run's revision history, so
redeploying by tag brings it back:

```bash
METABASE_IMAGE='metabase/metabase:v0.59.6' ./deploy.sh   # or whichever tag was prior
```

If the app DB schema migrated past the prior image's supported range
(Metabase runs migrations on startup automatically), rolling back the
container alone is not enough. Restore the Cloud SQL backup taken
before the upgrade:

Find the backup ID:

```bash
# Option A: scroll up in your terminal — backup.sh printed it, as did
# upgrade.sh if it failed.
# Option B: list recent backups for the instance:
gcloud sql backups list --instance=metabase-app-db --project=iampatterson \
  --sort-by="~windowStartTime" --limit=5
```

Then restore (downtime: ~5 min, instance stops, sessions drop):

```bash
gcloud sql backups restore <BACKUP_ID> \
  --restore-instance=metabase-app-db --project=iampatterson
```

### Rotate the BigQuery SA key

Annual rotation keeps the long-lived JSON key from being the longest
unchanged credential in the stack:

1. Create a new key for `metabase-bigquery@...` and upload to Secret
   Manager as a new version:

   ```bash
   KEY_TMP=$(mktemp)
   gcloud iam service-accounts keys create "${KEY_TMP}" \
     --iam-account=metabase-bigquery@iampatterson.iam.gserviceaccount.com \
     --project=iampatterson
   gcloud secrets versions add metabase-bq-sa-key \
     --project=iampatterson --data-file="${KEY_TMP}"
   shred -u "${KEY_TMP}" 2>/dev/null || rm -f "${KEY_TMP}"
   ```

2. Re-enter the BQ connection in Metabase UI (Task 7 step 7) with the
   new key content. Metabase re-encrypts with the current encryption
   key and starts using the new credential.

3. List existing keys for the SA and delete the old one:

   ```bash
   gcloud iam service-accounts keys list \
     --iam-account=metabase-bigquery@iampatterson.iam.gserviceaccount.com
   gcloud iam service-accounts keys delete <OLD_KEY_ID> \
     --iam-account=metabase-bigquery@iampatterson.iam.gserviceaccount.com
   ```

Do NOT rotate `metabase-encryption-key`. Rotating it breaks every
encrypted row in the Metabase app DB. See `.env.example` for the full
consequence statement.

### Add or remove an IAP allowlist member

Adding: edit the `ALLOWLIST` array at the top of `setup-iap.sh` and
re-run the script. See the Task 6 "Editing the allowlist" section.

Removing: manual, via `gcloud iap web remove-iam-policy-binding`. See
Task 6 for the command.

## Operational summary (quick reference)

| Task | When | Command |
|---|---|---|
| Backup | Before any risky change | `./backup.sh` |
| Upgrade | New Metabase stable released | `./upgrade.sh v0.59.7` |
| Restore | Bad upgrade, instance issue | `gcloud sql backups restore <ID> ...` |
| Rollback (image only) | Bad upgrade, no schema drift | `METABASE_IMAGE=<prior> ./deploy.sh` |
| Rotate BQ key | Annually | See "Rotate the BigQuery SA key" |
| Add allowlist member | Granting IAP access | Edit `setup-iap.sh` → re-run |
| Remove allowlist member | Revoking IAP access | `gcloud iap web remove-iam-policy-binding ...` |
| View daily backup | Check automated snapshots | `gcloud sql backups list --instance=metabase-app-db` |
