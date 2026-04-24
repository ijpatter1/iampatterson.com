# Future-date scrub (Phase 10c follow-up)

**Date:** 2026-04-24
**Source change:** `9d93915` (`fix(generator): clamp subscription lifecycle to endDate + UTC date math`)
**Companion SQL:** `10c-future-date-scrub-2026-04-24.sql`
**Owner:** human-applied. Apply only after the data-generator redeploy lands so the bug doesn't re-introduce future rows.

## Background

A long-standing bug in `infrastructure/cloud-run/data-generator/src/engines/subscription.ts` (`generateSubscriptionLifecycle`) projected up to 12 months of monthly renewal/churn events forward from each trial signup with no `endDate` clamp. Backfills near a horizon therefore wrote events with timestamps past the intended `endDate`. The live `events_raw` table accumulated:

| Event | Rows | First future timestamp | Last |
|---|---:|---|---|
| `subscription_renewal` | 3,049 | 2026-04-24T14:21:33Z | 2027-03-29T20:12:23Z |
| `subscription_churn` | 213 | 2026-04-24T13:31:01Z | 2027-03-29T15:18:26Z |
| **Total** | **3,262** | | |

The fix in `9d93915` adds an `endDate` parameter to `generateSubscriptionLifecycle` and breaks the monthly loop when projected dates exceed it. Threaded through `generateSessionForModel` from both `generateDateRange` and `streamingBackfill`. Pinned by an `it.each(['ecommerce','subscription','leadgen'])` test that asserts no event lands more than 1 day past `endDate` (1-day buffer for realistic intra-session spill).

The same commit also converts `getMonth/getDay/getHours/setMonth/setDate/setHours` calls across `session.ts` / `generator.ts` / `subscription.ts` / `ad-platform.ts` to their UTC variants. Cloud Run runs UTC by default so production was unaffected, but local-dev tests on non-UTC machines failed; this brings tests + prod onto the same TZ axis.

## Strategy: DELETE in place

These rows shouldn't exist at all (no semantic equivalent in the corrected world), so DELETE is correct rather than UPDATE. Cheap (3,262 rows) + idempotent (re-runs drop to zero affected rows once clean). BigQuery time-travel covers rollback for 7 days.

## Apply procedure

### Pre-flight

The data-generator must already be running the fixed code. Verify:

```bash
gcloud run services describe data-generator --region=us-central1 --project=iampatterson \
  --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)'
# Expected: revision name ≥ data-generator-00003-v9z
```

### Step 1, dry-run sizing (read-only)

```bash
bq --project_id=iampatterson query --use_legacy_sql=false \
  'SELECT event_name, COUNT(*) AS row_count
   FROM `iampatterson.iampatterson_raw.events_raw`
   WHERE timestamp IS NOT NULL
     AND COALESCE(
           SAFE.PARSE_TIMESTAMP("%Y-%m-%dT%H:%M:%E*S%Ez", timestamp),
           SAFE.PARSE_TIMESTAMP("%Y-%m-%dT%H:%M:%E*SZ", timestamp)
         ) > CURRENT_TIMESTAMP()
   GROUP BY event_name ORDER BY row_count DESC'
```

Expected: `subscription_renewal` ~3K + `subscription_churn` ~200 ≈ 3.3K total. Any other event types in the result indicate a *different* future-date bug that needs investigation before the scrub.

### Step 2, apply

```bash
bq --project_id=iampatterson query --use_legacy_sql=false \
  < infrastructure/bigquery/backfills/10c-future-date-scrub-2026-04-24.sql
```

### Step 3, post-apply verification

Should return 0:

```bash
bq --project_id=iampatterson query --use_legacy_sql=false \
  'SELECT COUNT(*) AS remaining
   FROM `iampatterson.iampatterson_raw.events_raw`
   WHERE timestamp IS NOT NULL
     AND COALESCE(
           SAFE.PARSE_TIMESTAMP("%Y-%m-%dT%H:%M:%E*S%Ez", timestamp),
           SAFE.PARSE_TIMESTAMP("%Y-%m-%dT%H:%M:%E*SZ", timestamp)
         ) > CURRENT_TIMESTAMP()'
```

Then trigger a Dataform workflow run so `stg_events`, `mart_*`, and the lifecycle-aware marts (`mart_customer_ltv`, `mart_subscription_cohorts`) recompute without the phantom future-month renewals.

## Rollback

BigQuery time-travel (default 7 days):

```sql
-- Re-insert the deleted rows from a snapshot 1 hour ago
INSERT INTO `iampatterson.iampatterson_raw.events_raw`
SELECT * FROM `iampatterson.iampatterson_raw.events_raw`
  FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
WHERE timestamp IS NOT NULL
  AND COALESCE(
        SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*S%Ez', timestamp),
        SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', timestamp)
      ) > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR);
```

## Out of scope

- `ad_platform_raw` is unaffected; the bug was specific to subscription lifecycle events flowing through sGTM, not the daily ad-platform records inserted directly via the BQ client.
- GA4 historical reports (immutable; not source of truth here).
- The 26-day `ad_platform_raw` gap (2026-03-29 → 2026-04-24) caused by the IAM outage — separate operational fill (`./backfill.sh --months 1` per model) tracked in the post-launch roadmap.
