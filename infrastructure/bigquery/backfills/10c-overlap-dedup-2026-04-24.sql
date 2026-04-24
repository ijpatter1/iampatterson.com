-- Phase 10c Pass-1 follow-up: ad_platform_raw 6-day overlap dedup
-- Author: 2026-04-24
-- Companion doc: 10c-overlap-dedup-2026-04-24.md
--
-- Background: filling the 26-day IAM-outage gap via ./backfill.sh ran
-- through the 6-day window (2026-03-24 → 2026-03-29) where the original
-- deploy-day backfill already had data. Result: 30 rows/day across that
-- window vs 15 rows/day baseline elsewhere — a visible 2x spike on the
-- daily ad-spend chart prospects see at bi.iampatterson.com/dashboard/2.
--
-- Strategy: keep one row per (date, platform, business_model, campaign_name)
-- via ROW_NUMBER() dedup. Tiebreak: highest spend (arbitrary; both rows
-- are equally synthetic). Implemented as a 3-step write so the table
-- partitioning + clustering survive — CREATE OR REPLACE on the live
-- table fails because the inferred schema drops the explicit
-- PARTITION BY date / CLUSTER BY platform, business_model spec.
--
-- Idempotent: re-running drops to a no-op once the window has 15
-- rows/day (the staging CTE returns one row per natural key regardless
-- of input cardinality; subsequent DELETE+INSERT round-trips a
-- byte-identical subset back).

-- Step 1: stage the deduped rows for the affected window.
CREATE OR REPLACE TABLE `iampatterson.iampatterson_raw.ad_platform_dedup_tmp` AS
SELECT * EXCEPT(rn) FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY date, platform, business_model, campaign_name
    ORDER BY spend DESC, campaign_name_raw
  ) AS rn
  FROM `iampatterson.iampatterson_raw.ad_platform_raw`
  WHERE date BETWEEN '2026-03-24' AND '2026-03-29'
)
WHERE rn = 1;

-- Step 2: delete all rows in the affected window.
DELETE FROM `iampatterson.iampatterson_raw.ad_platform_raw`
WHERE date BETWEEN '2026-03-24' AND '2026-03-29';

-- Step 3: re-insert the deduped subset.
INSERT INTO `iampatterson.iampatterson_raw.ad_platform_raw`
SELECT * FROM `iampatterson.iampatterson_raw.ad_platform_dedup_tmp`;

-- Step 4: drop staging table.
DROP TABLE `iampatterson.iampatterson_raw.ad_platform_dedup_tmp`;
