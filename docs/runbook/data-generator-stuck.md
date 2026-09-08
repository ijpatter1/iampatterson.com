# Data generator stuck or failing

**Alert that leads here:** `Cloud Scheduler job attempt failed`.

## What it is

The site is a demonstration, and a demonstration with no traffic shows nothing.
`data-generator` is a Cloud Run service that synthesises realistic sessions —
page views, product views, carts, purchases — and sends them through the same
pipeline a real visitor uses. Three Cloud Scheduler jobs invoke it on weekdays at
`:00`, `:20` and `:40` past the hour.

If it stops, the dashboards go flat. Nothing breaks loudly.

## Diagnose

Which job failed, and what did it say?

```bash
gcloud scheduler jobs list --project=iampatterson --location=us-central1 \
  --format='value(name, state, lastAttemptTime, status.code)'
```

```bash
gcloud logging read \
  'resource.type="cloud_scheduler_job" AND severity>=ERROR' \
  --project=iampatterson --limit=10 --freshness=6h \
  --format='value(timestamp, jsonPayload.status, jsonPayload.jobName)'
```

A `status: INTERNAL` with `URL_UNREACHABLE-UNREACHABLE_5xx` usually means the
service could not be reached rather than that it ran and failed. Check whether
Cloud Run refused for want of an instance:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="data-generator"
   AND textPayload:"no available instance"' \
  --project=iampatterson --limit=10 --freshness=24h
```

That is a known and accepted condition here. `data-generator` scales to zero and
every scheduled run is a cold start, so occasionally Cloud Run aborts a request
before an instance is ready. It happened once in the 30 days to 2026-09-05. The
next run twenty minutes later succeeds, and buying an always-on instance to
prevent one dropped synthetic event a month was judged not worth it. One abort is
not an incident. A run of them is.

## Fix

Invoke it by hand and watch what it says. The service requires authentication:

```bash
TOK=$(gcloud auth print-identity-token)
URL=$(gcloud run services describe data-generator --project=iampatterson \
  --region=us-central1 --format='value(status.url)')
curl -s -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  "$URL/generate" -d '{}'
```

It answers with what it did: how many sessions and events it produced, how many
were sent, and how many failed. A response with `"failed": 0` on both
`sendResult` and `adInsertResult` means the whole path works and the problem was
transient.

If `sendResult` reports failures, the generator is fine and the problem is
downstream — go to [sGTM not responding](sgtm-not-responding.md).

If `adInsertResult` reports failures, the generator cannot write to BigQuery
directly. Since 2026-09-05 it runs as `data-gen-runtime`, which holds
`bigquery.jobUser` on the project and `WRITER` on the `iampatterson_raw` dataset.
Check those are still in place.

## A trap worth knowing

`data-generator` has its traffic pinned to a specific revision rather than
following the newest one. If you change the service and the change does not seem
to take effect, that is why: a new revision was created and traffic stayed where
it was.

```bash
gcloud run services describe data-generator --project=iampatterson \
  --region=us-central1 --format='value(status.traffic[0].revisionName, status.latestCreatedRevisionName)'
```

If those differ and you meant the new one to serve:

```bash
gcloud run services update-traffic data-generator --project=iampatterson \
  --region=us-central1 --to-revisions=<new-revision>=100
```

This bit real work on 2026-09-05: a service account change appeared to apply
while the serving revision kept running as the old identity.

## How you know it worked

Rows arrive. Count before and after a manual invocation:

```bash
bq query --project_id=iampatterson --nouse_legacy_sql \
  'SELECT COUNT(*) FROM `iampatterson.iampatterson_raw.events_raw`'
```

The count should rise by exactly the number of events the invocation said it
sent.

## Rehearsal

Rehearsed on 2026-09-05 as part of the runtime identity migration. The generator
was invoked by hand twice under a newly changed service account: the first run
reported 712 events sent with none failed and `events_raw` rose by exactly 712;
the second reported 117 and the table rose by exactly 117. Both the invocation
path and the row-count verification in this entry are the ones that were used.
Record: `docs/verification/2026-09-05-cloud-run-adoption-measured.md`.
