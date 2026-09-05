# BigQuery spend

**Alert that leads here:** `BigQuery billed scan above 1 TB in a day`.

## What the threshold means

BigQuery charges for bytes scanned by queries, not for bytes stored — storage
here is trivial. The whole warehouse was 745 MiB on 2026-09-05, against a free
tier of 10 GiB. A terabyte scanned in one day is therefore not a data-growth
problem. It means something ran a lot of expensive queries, and at roughly $6.25
per TB it is worth understanding rather than ignoring.

The first free terabyte each month costs nothing, so a single day crossing the
threshold is a signal, not a bill.

## Diagnose

What ran, and what did it cost?

```bash
bq query --project_id=iampatterson --nouse_legacy_sql --format=prettyjson \
'SELECT
   job_id,
   user_email,
   ROUND(total_bytes_billed / POW(2,40), 3) AS tib_billed,
   creation_time,
   SUBSTR(query, 0, 200) AS query_head
 FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
 WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY)
   AND total_bytes_billed > 0
 ORDER BY total_bytes_billed DESC
 LIMIT 10'
```

`user_email` is the thing to read first. It tells you which of the four possible
causes this is.

## The four causes, in order of likelihood

**Metabase.** A dashboard question with no filter, or one someone left
auto-refreshing. Metabase reads through `metabase-bigquery@`, which is scoped
read-only to `iampatterson_marts`. The marts are small, so this is usually a
query that joins badly rather than one that reads a lot.

**Dataform.** The nightly run rebuilds staging and marts from raw. It is the
largest scheduled consumer and its cost is proportional to the raw window, which
is capped at 60 days by partition expiry.

**A person exploring.** Interactive queries against `events_raw` without a
partition filter scan the whole 60-day window every time. This is the most common
cause of an unexpected spike and the easiest to fix.

**A runaway loop.** Something querying in a retry loop. Rare, and the job list
makes it obvious because the same query appears many times.

## Fix

**If it is exploratory querying**, filter on the partition column. `events_raw`
is partitioned on ingestion time, so:

```sql
WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
```

turns a 60-day scan into a 7-day one. The staging and mart tables are small
enough that this rarely matters there.

**If it is a Metabase question**, find it from the query text and add a date
filter, or reduce its refresh interval.

**If you need a hard stop**, set a maximum bytes billed on the offending query or
a custom quota on the project. Neither is configured today, deliberately: at this
scale the alert is the control, and a hard quota that silently fails the nightly
Dataform run would cost more than the overspend.

## The budget behind this

The project carries `metabase-project-budget` at $200/month with thresholds at
50, 90 and 100 %. Until 2026-09-05 it had no notification channel at all, so it
could be crossed in silence; it now emails `ops-email`. That budget covers the
whole project, so Claudish's Vertex spend appears in it too.

## How you know it worked

The daily billed scan falls back below the threshold, which you can confirm by
re-running the job query above for the current day. The alert closes on its own.

## Rehearsal

Not rehearsed, and deliberately not. Firing this alert requires scanning a
terabyte, which costs real money to stage and would itself be the incident. The
alert's condition is a threshold on a metric BigQuery publishes continuously, and
its notification path is the same one every other threshold policy in this
project uses, two of which fired for real during Phase 12. Manufacturing a
billing event to prove a threshold works is not a reasonable trade.
