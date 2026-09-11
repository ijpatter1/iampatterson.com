# Metabase Dashboards as Code

Phase 9B deliverable 6a: the e-commerce Metabase dashboard defined as versioned YAML specs and applied to the live instance at `https://bi.iampatterson.com/` via an idempotent driver script.

**Specs are the source of truth.** Any question or dashboard authored directly in the Metabase UI without a corresponding spec here is drift — `apply.sh` will not touch it, but it is not part of the portfolio story.

---

## Why this exists

The Tier 2 demo story ("data you can version-control") extends naturally to BI. Dashboards and questions live in git, reviewable as diffs, reproducible on a fresh Metabase instance with a single script invocation. Same philosophy as Dataform for transformations — no click-ops on anything that matters.

---

## Directory layout

```
infrastructure/metabase/dashboards/
├── apply.sh                  # idempotent upsert driver
├── README.md                 # this file
├── lib/
│   └── metabase_client.sh    # curl wrappers around the REST API
├── specs/
│   ├── questions/
│   │   ├── 01_funnel_conversion_by_channel.yaml
│   │   ├── 02_aov_trend_90d.yaml
│   │   ├── 03_roas_by_campaign.yaml
│   │   ├── 04_revenue_share_by_channel.yaml
│   │   ├── 05_customer_ltv_distribution.yaml
│   │   └── 06_daily_revenue_trend.yaml
│   └── dashboards/
│       └── ecommerce_executive.yaml
└── .ids.json                 # gitignored; IDs resolved by apply.sh
```

---

## Authentication model

`apply.sh` authenticates to Metabase using an admin API key stored in Secret Manager.

**Only the embed surface on `bi.iampatterson.com` bypasses IAP.** Since 2026-09-11 the carve-out is `/api/embed/*`, `/app/*` and `/embed/*`; the rest of `/api/*`, including everything `apply.sh` calls, is IAP-gated. The old `/api/*` carve-out was exploited through CVE-2026-72898 on 2026-09-03, 09-04 and 09-10. `apply.sh` needs an IAP-authorised request in addition to its admin API key, and fails against the public host until that is added. The UI path (`/*`) remains IAP-gated; only allowlisted accounts can browse the Metabase frontend.

**`apply.sh` does not work until it authenticates through IAP.** Its requests now get IAP's 302 or 401, and `lib/metabase_client.sh` treats a 302 as success, so a run fails with a jq parse error or an empty "Authenticated to Metabase as" line rather than an IAP message. A 401 here is not a bad API key; do not regenerate the key in response. Tracked in `docs/BACKLOG.md`.

The split is declared in `infrastructure/terraform/metabase-lb.tf`: a non-IAP backend service (`metabase-backend-direct`) and a URL-map path matcher carving `/api/embed/*`, `/app/*` and `/embed/*` out to it. `terraform apply` reconciles it. The one-shot `setup-domain.sh` that originally provisioned this was retired in [14.2]; it had already lost the `/app/*` path added after the 9F incident, so it could no longer reproduce production.

---

## One-time setup

### 1. Apply the URL-map split with Terraform

```bash
# From the repository root — `-chdir` is relative to where you invoke it.
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)
terraform -chdir=infrastructure/terraform init   # state is remote, in GCS
terraform -chdir=infrastructure/terraform plan   # read this before the next line
terraform -chdir=infrastructure/terraform apply  # IAP: docs/runbook/metabase-access.md
```

**Read the plan.** This is a flat root that owns the whole project — six
Cloud Run services, Cloud SQL, Pub/Sub, the datasets — not just the load
balancer, so the plan covers far more than the URL-map split you came here
for. `infrastructure/terraform/README.md` is explicit that a destructive
plan against the load balancer, IAP, the managed certificate or Cloud SQL is
a release blocker, not a convergence step. Against a converged root the
apply is a no-op.

Verify:

```bash
curl -sI https://bi.iampatterson.com/api/embed/dashboard/not-a-token | head -3
# expect: an error status from Metabase itself, not 302  (the embed API bypasses IAP)

curl -sI https://bi.iampatterson.com/api/health | head -3
# expect: HTTP/2 302  (the rest of the API is IAP-gated)

curl -sI https://bi.iampatterson.com/ | head -3
# expect: HTTP/2 302  (IAP redirects to Google SSO)
```

Then open `https://www.iampatterson.com/demo/ecommerce/confirmation` in a private window and confirm the dashboard renders. Use a private window: a signed-in IAP cookie from your own browser authorises requests the anonymous visitor cannot make, and hides failures. The embed's own `/api/session/properties` request gets IAP's 302 and fails; the dashboard renders without it (checked 2026-09-11).

### 2. Generate a Metabase admin API key

1. Browse to `https://bi.iampatterson.com/admin/settings/authentication/api-keys` (IAP-gated — log in as admin).
2. **Create API Key.** Name: `apply-sh`. Group: Admin.
3. Copy the key value. It will not be shown again.

### 3. Store the key in Secret Manager

```bash
echo -n "<the-api-key-you-just-copied>" | \
  gcloud secrets create metabase-api-key \
    --project=iampatterson \
    --replication-policy="automatic" \
    --data-file=-
```

Grant the runtime service account read access (one-time):

```bash
gcloud secrets add-iam-policy-binding metabase-api-key \
  --project=iampatterson \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/secretmanager.secretAccessor"
```

### 4. Install local tools

`apply.sh` requires `yq` (mikefarah/yq v4+), `jq`, `curl`, and `gcloud`.

```bash
# macOS
brew install yq jq

# Linux
# yq: https://github.com/mikefarah/yq/#install
# jq: apt-get install jq / dnf install jq
```

---

## Applying the specs

```bash
cd /workspace/infrastructure/metabase/dashboards
./apply.sh --dry-run        # preview actions; no API writes
./apply.sh                  # apply
```

**Both of these fail today.** `apply.sh` authenticates with `GET /api/user/current` before it does anything else, and that path is IAP-gated since 2026-09-11. `--dry-run` is no exception: it skips writes, not the authentication.

On success, `.ids.json` is written with the resolved IDs:

```json
{
  "databaseId": 2,
  "collectionId": 42,
  "dashboardId": 7,
  "cardIds": {
    "Funnel conversion by channel": 101,
    "AOV trend (90 days)": 102,
    ...
  }
}
```

### Publishing the embed config (deliverable 6b)

When deliverable 6b is ready, pass `--publish-embed-config` to also push the IDs to the `metabase-embed-config` Secret Manager secret for the Next.js signer to consume:

```bash
./apply.sh --publish-embed-config
```

**Note: `.ids.json` and the `metabase-embed-config` secret have intentionally different shapes.**

- `.ids.json` (local, for debugging) keys cards by their full display name: `{ "Funnel conversion by channel": 101, ... }`.
- `metabase-embed-config` (Secret Manager, consumed by 6b's Next.js signer) uses friendly keys: `{ dashboardId, cardIds: { funnel, aov, dailyRevenue } }`.

The friendly-key mapping is hard-coded in `apply.sh`'s `--publish-embed-config` block. If you rename one of the three embeddable questions (funnel, aov, daily revenue) in its YAML `name:` field, the preflight will fail with `ERROR: embed config missing card IDs for: ...`. Update the literal in `apply.sh` to match.

### Prerequisite: enable static embedding in Metabase UI

`enable_embedding: true` on a card or dashboard is a no-op until the **global** Metabase setting `enable-embedding-static` is turned on. This is a one-time toggle:

1. Open `https://bi.iampatterson.com/admin/settings/embedding-in-other-applications`.
2. Under **Static embedding**, click **Enable**.
3. Copy the auto-generated **Embedding secret key** (`MB_EMBEDDING_SECRET_KEY`) — deliverable 6b's Next.js signer will use this to mint JWTs.

Until this toggle is flipped, the signed-embed URLs deliverable 6b produces will return 404 from `/embed/*` even though `apply.sh` happily sets `enable_embedding: true` on individual cards.

---

## Authoring new questions

1. Copy an existing spec in `specs/questions/` as a template.
2. Edit the fields:
   - `name` — unique within the collection (used as the idempotency key)
   - `description` — optional
   - `display` — `bar`, `line`, `pie`, `funnel`, `scalar`, `table`, …
   - `visualization_settings` — passed through to Metabase as-is
   - `query` — native SQL string (multi-line `|` preferred for readability)
   - `enable_embedding` — `true` to allow signed-JWT embedding (required for deliverable 6b consumers)
3. Run `./apply.sh --dry-run` to preview.
4. Run `./apply.sh` to apply.
5. Add the question to `specs/dashboards/ecommerce_executive.yaml` under `cards:` with grid coordinates.
6. Re-run `apply.sh` to place the card on the dashboard.
7. Commit the spec file and the PHASE_STATUS update.

### Native SQL convention

All queries target the `iampatterson.iampatterson_marts.*` tables (fully qualified). Use `CURRENT_DATE()` / `DATE_SUB` for relative windows — this keeps dashboards useful regardless of how long the Metabase instance has been running.

The ad-hoc backfill is 18 months wide, so windows up to 540 days work.

### Dashboard grid

Metabase uses a 24-column grid. Each row is roughly 22px tall. Standard card sizes:

| Size | Meaning |
|---|---|
| `size_x: 12, size_y: 6` | Half-width medium card |
| `size_x: 24, size_y: 6` | Full-width medium card |
| `size_x: 8, size_y: 6` | Third-width small card |

Position with `row` (0-indexed top-to-bottom) and `col` (0-23).

---

## Troubleshooting

**`ERROR: GET /api/user/current returned HTTP 401`** — since 2026-09-11 this is IAP, not the API key. `/api/user/current` is IAP-gated and `apply.sh` does not authenticate through IAP; see the warning at the top of this file. Do not regenerate the key. Only once the request reaches Metabase at all is the key worth suspecting, in which case regenerate it in Metabase and re-upload to Secret Manager.

**`ERROR: database 'iampatterson marts' not found`** — the BigQuery data source wasn't added in Metabase UI. See `infrastructure/metabase/README.md` Task 7, step 5.

**`ERROR: POST /api/card returned HTTP 400 ... "query must be a non-empty string"`** — the YAML `query:` field is empty or miswrapped. Use a literal block scalar (`query: |`).

**`ERROR: POST /api/dashboard/N returned HTTP 400`** — dashcard positions overlap. The 24-col grid rejects two cards occupying the same cells. Check the dashboard spec's `cards[].row`, `col`, `size_x`, `size_y`.

**Cards get created but don't appear on the dashboard** — the dashboard spec's `cards[].card` must match the question spec's `name` exactly (case-sensitive).
