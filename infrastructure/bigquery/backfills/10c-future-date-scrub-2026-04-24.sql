-- Phase 10c follow-up: future-date scrub
-- Author: 2026-04-24
-- Companion doc: 10c-future-date-scrub-2026-04-24.md
--
-- Background: a long-standing data-generator bug (fixed in commit
-- 9d93915, "fix(generator): clamp subscription lifecycle to endDate +
-- UTC date math") projected up to 12 months of monthly subscription
-- renewal/churn events forward from each trial signup with no endDate
-- clamp. Backfills near a horizon therefore wrote events with
-- timestamps past the intended endDate; the live table accumulated
-- ~3.3K rows with timestamps as far out as 2027-03-29.
--
-- This scrub deletes events whose simulated timestamp lies in the
-- future relative to wall-clock now. Idempotent: re-runs drop to zero
-- affected rows.
--
-- Encoding note: events_raw.timestamp is the ISO 8601 client-side
-- timestamp string (e.g. '2027-03-29T20:12:23.000Z'); SAFE.PARSE
-- handles both with and without the trailing Z + millisecond fraction.

DELETE FROM `iampatterson.iampatterson_raw.events_raw`
WHERE timestamp IS NOT NULL
  AND COALESCE(
        SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*S%Ez', timestamp),
        SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', timestamp)
      ) > CURRENT_TIMESTAMP();
