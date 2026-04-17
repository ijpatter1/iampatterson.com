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

**The `/api/*` path on `bi.iampatterson.com` bypasses IAP.** This is intentional — an admin API key is the auth credential for the API path, not Google SSO. The UI path (`/*`) remains IAP-gated; only allowlisted accounts can browse the Metabase frontend.

The split is provisioned by `infrastructure/metabase/setup-domain.sh` (step 8: non-IAP backend service + URL-map path matcher for `/api/*` and `/embed/*`). Re-run `setup-domain.sh` once to apply it if this is a fresh deployment from before the split landed.

---

## One-time setup

### 1. Re-run `setup-domain.sh` for the URL-map split

```bash
cd /workspace/infrastructure/metabase
./setup-domain.sh --no-wait
```

Idempotent — existing LB components are skipped, the new non-IAP backend + path matcher are added.

Verify:

```bash
curl -sI https://bi.iampatterson.com/api/health | head -3
# expect: HTTP/2 200  (direct from Metabase; IAP bypassed)

curl -sI https://bi.iampatterson.com/ | head -3
# expect: HTTP/2 302  (IAP redirects to Google SSO)
```

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

**`ERROR: GET /api/user/current returned HTTP 401`** — the API key is wrong, expired, or the secret has the wrong value. Regenerate in Metabase and re-upload to Secret Manager.

**`ERROR: database 'iampatterson marts' not found`** — the BigQuery data source wasn't added in Metabase UI. See `infrastructure/metabase/README.md` Task 7, step 5.

**`ERROR: POST /api/card returned HTTP 400 ... "query must be a non-empty string"`** — the YAML `query:` field is empty or miswrapped. Use a literal block scalar (`query: |`).

**`ERROR: POST /api/dashboard/N returned HTTP 400`** — dashcard positions overlap. The 24-col grid rejects two cards occupying the same cells. Check the dashboard spec's `cards[].row`, `col`, `size_x`, `size_y`.

**Cards get created but don't appear on the dashboard** — the dashboard spec's `cards[].card` must match the question spec's `name` exactly (case-sensitive).
