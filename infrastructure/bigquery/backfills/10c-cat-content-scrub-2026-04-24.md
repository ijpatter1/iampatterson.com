# Cat-content scrub (Phase 10c D2)

**Date:** 2026-04-24
**Source change:** Phase 10c D1, commit `bccdb74` (`feat(10c-d1): replace cat-themed campaigns with dog-themed equivalents + brand vocab pin`)
**Companion SQL:** `10c-cat-content-scrub-2026-04-24.sql`
**Owner:** human-applied. Claude wrote the SQL + verification queries; the `bq query` apply needs explicit user authorization.

## Background

Tuna is a chiweenie, not a cat. Three LLM-hallucinated paid-media campaigns shipped from `infrastructure/cloud-run/data-generator/src/profiles.ts` to BigQuery before anyone caught them. D1 corrected the source. D2 backfills the rows already on disk so the live tables match the corrected source.

## Impact map

Rows carrying cat-themed labels live in two BigQuery tables, both in `iampatterson_raw`:

| Table | Column | Encoding | Distinct legacy values | Notes |
|---|---|---|---|---|
| `events_raw` | `utm_campaign` | form-urlencoded | 10 | sGTM forwards `/g/collect` params without decoding; spaces → `+` |
| `ad_platform_raw` | `campaign_name` | raw | 3 | Canonical campaign name. Generator inserts via `@google-cloud/bigquery` directly |
| `ad_platform_raw` | `campaign_name_raw` | raw | 10 | UTM variant (intentionally inconsistent for taxonomy demo) |

Downstream Dataform models that *consume* but don't *store* their own cat literals — these recompute clean on the next workflow run after the raw scrub:

- `iampatterson_staging.stg_events` — passes through `utm_campaign` (with URL-decode)
- `iampatterson_staging.stg_ad_platform` — passes through `campaign_name` + `campaign_name_raw`
- `iampatterson_marts.campaign_taxonomy` — AI.CLASSIFY reclassifies on next run from the new dog-themed labels
- `iampatterson_marts.campaign_taxonomy_validation` — reads `campaign_taxonomy`
- `iampatterson_marts.mart_channel_attribution` and other UTM-aggregating marts

One Dataform model that *did* contain a dead cat literal post-scrub: `campaign_taxonomy_rules.sqlx` had `cat.?lover` in the `prospecting` regex branch. Updated in this same change to drop the dead token and add `small.?dog|dog.?owner` for the new labels — without that update the regex would lie about what's in the data.

## Strategy: UPDATE in place

Picked over delete-and-regenerate. Reasoning:

- **Surgical:** the remap is a deterministic 10-pair string→string map. Every row's correction is a closed-form lookup, not a re-roll.
- **Preserves event integrity:** session arcs, timestamps, and `event_id` (SHA256 of event_name|session_id|received_timestamp|page_path) all survive. Downstream marts that key on `event_id` keep their continuity; subsequent Dataform runs only have to recompute aggregates that touched the changed values.
- **Cheaper than re-gen:** delete-and-regen would mean truncating ~18 months of partitions and re-running the generator's backfill (~250 sessions/day × 18mo with concurrent batches ≈ hours of wall-clock time). UPDATE DML on these small tables runs in seconds.
- **Auditable:** the scrub commit + the SQL file are the receipt for what changed.

Delete-and-regenerate would only win if DML cost dominated, which it doesn't on synthetic-volume tables.

## Apply procedure

### Pre-flight

Refresh application-default credentials (the dry-run + apply both need ADC, not user creds):

```bash
gcloud auth application-default login
```

### Step 1, dry-run sizing (read-only, ~free)

Estimate bytes scanned + see the row breakdown:

```bash
bq --project_id=iampatterson query --dry_run --use_legacy_sql=false \
  'SELECT utm_campaign, COUNT(*) FROM `iampatterson.iampatterson_raw.events_raw`
   WHERE LOWER(utm_campaign) LIKE "%cat%" GROUP BY utm_campaign'

bq --project_id=iampatterson query --use_legacy_sql=false \
  'SELECT utm_campaign, COUNT(*) AS row_count
   FROM `iampatterson.iampatterson_raw.events_raw`
   WHERE LOWER(utm_campaign) LIKE "%cat%"
   GROUP BY utm_campaign ORDER BY row_count DESC'

bq --project_id=iampatterson query --use_legacy_sql=false \
  'SELECT campaign_name, campaign_name_raw, COUNT(*) AS row_count,
          MIN(date) AS first_date, MAX(date) AS last_date,
          SUM(spend) AS total_spend
   FROM `iampatterson.iampatterson_raw.ad_platform_raw`
   WHERE LOWER(campaign_name) LIKE "%cat%"
      OR LOWER(campaign_name_raw) LIKE "%cat%"
   GROUP BY campaign_name, campaign_name_raw ORDER BY row_count DESC'
```

If any of the legacy strings have zero rows, the corresponding `WHEN` branch in the SQL is a no-op — safe but informative for the apply log.

### Step 2, apply

```bash
bq --project_id=iampatterson query --use_legacy_sql=false \
  < infrastructure/bigquery/backfills/10c-cat-content-scrub-2026-04-24.sql
```

Or, if you want each statement's affected-row count visible in the CLI output, run them separately by splitting on `-- =====` headers and piping each block through `bq query` individually.

### Step 3, post-apply verification

Both must return 0:

```bash
bq --project_id=iampatterson query --use_legacy_sql=false \
  'SELECT COUNT(*) AS remaining
   FROM `iampatterson.iampatterson_raw.events_raw`
   WHERE LOWER(utm_campaign) LIKE "%cat%"'

bq --project_id=iampatterson query --use_legacy_sql=false \
  'SELECT COUNT(*) AS remaining
   FROM `iampatterson.iampatterson_raw.ad_platform_raw`
   WHERE LOWER(campaign_name) LIKE "%cat%"
      OR LOWER(campaign_name_raw) LIKE "%cat%"'
```

Then trigger a fresh Dataform workflow run so `stg_*`, `campaign_taxonomy`, and downstream marts pick up the new labels.

## Rollback

If the apply lands incorrect strings (typo in the remap, encoding mismatch, etc.), the inverse remap is also a deterministic 10-pair lookup. Re-run a mirror SQL with `WHEN '<new>' THEN '<old>'` swapped on each clause. The remap table below is the single source of truth for both directions.

BigQuery time-travel (default 7 days) is also available for emergency point-in-time recovery:

```sql
SELECT * FROM `iampatterson.iampatterson_raw.events_raw`
FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR);
```

## Remap (source of truth)

This is the deterministic remap. Generator code, scrub SQL, and any future rollback all derive from it.

### `events_raw.utm_campaign` (form-urlencoded)

| From | To |
|---|---|
| `google_prosp_catlovers` | `google_prosp_smalldogs` |
| `Google+Prospecting+Cat+Lovers` | `Google+Prospecting+Small+Dog+Owners` |
| `g_prospect_cat-lovers` | `g_prospect_small-dogs` |
| `meta_broad_catcontent` | `meta_broad_dogcontent` |
| `FB+Broad+Cat+Content` | `FB+Broad+Dog+Content` |
| `META_BROAD_CAT` | `META_BROAD_DOG` |
| `meta-broad-cat-content` | `meta-broad-dog-content` |
| `google_search_catsub` | `google_search_dogsub` |
| `Google+Search+-+Cat+Subscription+Box` | `Google+Search+-+Dog+Subscription+Box` |
| `g_srch_cat_sub_box` | `g_srch_dog_sub_box` |

### `ad_platform_raw.campaign_name` (canonical, raw)

| From | To |
|---|---|
| `Google - Prospecting - Cat Lovers` | `Google - Prospecting - Small Dog Owners` |
| `Meta - Broad - Cat Content` | `Meta - Broad - Dog Content` |
| `Google - Search - Cat Subscription Box` | `Google - Search - Dog Subscription Box` |

### `ad_platform_raw.campaign_name_raw` (UTM variant, raw — not URL-encoded)

| From | To |
|---|---|
| `google_prosp_catlovers` | `google_prosp_smalldogs` |
| `Google Prospecting Cat Lovers` | `Google Prospecting Small Dog Owners` |
| `g_prospect_cat-lovers` | `g_prospect_small-dogs` |
| `meta_broad_catcontent` | `meta_broad_dogcontent` |
| `FB Broad Cat Content` | `FB Broad Dog Content` |
| `META_BROAD_CAT` | `META_BROAD_DOG` |
| `meta-broad-cat-content` | `meta-broad-dog-content` |
| `google_search_catsub` | `google_search_dogsub` |
| `Google Search - Cat Subscription Box` | `Google Search - Dog Subscription Box` |
| `g_srch_cat_sub_box` | `g_srch_dog_sub_box` |

## Out of scope

- Scrubbing GA4 historical data (cat labels in GA4 reports are immutable; GA4 is not the source of truth for this site's analytics).
- AI-generated narratives in the RAG semantic layer (`infrastructure/bigquery/rag/`); these regenerate from current data on next prompt and don't store their own cat literals.
- Rebuilding `campaign_taxonomy` partitions older than the AI.CLASSIFY response cache; reclassification on next workflow run is sufficient.
