# ad_platform_raw 6-day overlap dedup (Phase 10c Pass-1 follow-up)

**Date:** 2026-04-24
**Source:** product-reviewer Pass-1 Major #1 (visible 2× spike on daily ad-spend chart undermines the "honest data" demo thesis).
**Companion SQL:** `10c-overlap-dedup-2026-04-24.sql`
**Owner:** human-applied. Three DML statements against shared `iampatterson_raw`.

## Background

Filling the 26-day IAM-outage gap via `./backfill.sh --months 1` per model on 2026-04-24 (this session) ran through the 6-day window 2026-03-24 → 2026-03-29 where the original deploy-day backfill already had data. The 6 days now show 30 rows/day vs the 15-rows/day baseline elsewhere — a visible 2× spike on the daily ad-spend chart at `bi.iampatterson.com/dashboard/2`.

| Window | Rows/day | Source |
|---|---|---|
| 2026-03-21 → 2026-03-23 | 15 | Initial deploy-day backfill (1mo) |
| **2026-03-24 → 2026-03-29** | **30** | Initial + Pass-0 backfill overlap |
| 2026-03-30 → 2026-04-24 | 15 | Pass-0 backfill (gap fill) |

The two row sets are byte-different: the original used `seed = endDate.getTime() = 2026-03-29 deploy day`; the rerun used `seed = 2026-04-24 today`. Same canonical campaign labels, different random impressions / clicks / spend / cpc / ctr metrics. The natural key (date, platform, business_model, campaign_name) collides; the value tuple doesn't.

## Strategy: 3-step DELETE + re-INSERT after staging

Picked over single-statement DELETE because BigQuery DELETE doesn't support window functions in the WHERE clause; over CREATE OR REPLACE on the live table because the inferred schema drops the explicit `PARTITION BY date` + `CLUSTER BY platform, business_model` spec (the same gotcha that blocked the streaming-buffer flush attempt earlier this session).

The 3-step write preserves partitioning + clustering, runs as 4 short query jobs, and is idempotent (re-running on already-deduped data is a byte-identical round-trip).

Tiebreak: keep the row with the highest `spend`, then the lowest `campaign_name_raw` (lexicographic). Both rows are equally synthetic so the choice is arbitrary; the deterministic tiebreak makes the apply reproducible if it needs to be re-run for any reason.

## Apply procedure

### Pre-flight

Refresh ADC if not done already:

```bash
gcloud auth application-default login
```

### Step 1, dry-run sizing (read-only)

```bash
bq --project_id=iampatterson query --use_legacy_sql=false \
  'SELECT date, COUNT(*) AS n_rows
   FROM `iampatterson.iampatterson_raw.ad_platform_raw`
   WHERE date BETWEEN "2026-03-24" AND "2026-03-29"
   GROUP BY date ORDER BY date'
```

Expected pre-apply: 30 rows on each of the 6 dates (180 total). Post-apply: 15 rows on each (90 total). Net deletion: 90 rows.

### Step 2, apply

```bash
bq --project_id=iampatterson query --use_legacy_sql=false \
  < infrastructure/bigquery/backfills/10c-overlap-dedup-2026-04-24.sql
```

The 4 statements run sequentially. Any failure mid-script leaves the live table in a partial state — re-run the script (it's idempotent) or restore from BQ time-travel if needed.

### Step 3, post-apply verification

```bash
bq --project_id=iampatterson query --use_legacy_sql=false \
  'SELECT date, COUNT(*) AS n_rows
   FROM `iampatterson.iampatterson_raw.ad_platform_raw`
   WHERE date BETWEEN "2026-03-24" AND "2026-03-29"
   GROUP BY date ORDER BY date'
```

Expected: 15 rows on each of the 6 dates.

Then trigger a Dataform workflow run so the marts recompute:

```bash
curl -s -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"workflowConfig":"projects/iampatterson/locations/us-central1/repositories/iampatterson-dataform/workflowConfigs/production-config"}' \
  "https://dataform.googleapis.com/v1beta1/projects/iampatterson/locations/us-central1/repositories/iampatterson-dataform/workflowInvocations"
```

## Rollback

BigQuery time-travel (default 7 days). Restore the 90 deleted rows by:

```sql
INSERT INTO `iampatterson.iampatterson_raw.ad_platform_raw`
SELECT * FROM `iampatterson.iampatterson_raw.ad_platform_raw`
  FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
WHERE date BETWEEN '2026-03-24' AND '2026-03-29'
EXCEPT DISTINCT
SELECT * FROM `iampatterson.iampatterson_raw.ad_platform_raw`
WHERE date BETWEEN '2026-03-24' AND '2026-03-29';
```

## Out of scope

- The hourly schedule's same-day re-emission idempotency is handled by the MERGE refactor (commit `9911f58`); it doesn't affect this 6-day historical window.
- The other gap-fill artifact (subscription + leadgen models being absent from 2026-03-30 → 2026-04-24 before the Pass-0 backfill) was already corrected by the gap-fill itself; no further dedup needed there.
