# sGTM not responding

**Alerts that lead here:** `Cloud Run 5xx: more than 10 in 5 minutes on any
service`, `Cloud Run instance aborts: no available instance`, and the uptime
check `sgtm-healthy`.

## What sGTM is, and why this matters

sGTM is server-side Google Tag Manager, running as a Cloud Run service called
`sgtm` behind `io.iampatterson.com`. Every measurement event the website
produces is sent to it, and it forwards them to BigQuery and Pub/Sub. It is the
neck of the funnel: if it is down, the site still loads perfectly and nobody
complains, and no data arrives. That silence is the reason this entry exists.

## Diagnose

Start with whether it is actually down.

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://io.iampatterson.com/healthy
```

A `200` means the service is up and the problem is narrower than "not
responding" — skip to the abort check below. Anything else, or a timeout, means
it is genuinely unreachable.

What revision is serving, and when did it arrive?

```bash
gcloud run services describe sgtm --project=iampatterson --region=us-central1 \
  --format='value(status.traffic[0].revisionName, status.latestReadyRevisionName)'
```

If those two differ, traffic is pinned to something other than the newest
revision. That is deliberate in this project — deploys create a revision without
routing to it — but it means a fix you deployed may not be serving.

Are requests being aborted for want of an instance?

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="sgtm"
   AND textPayload:"no available instance"' \
  --project=iampatterson --limit=20 --format='value(timestamp)'
```

This is the failure that does not look like one. Cloud Run refuses the request,
returns 500, and the visitor's events are gone. There is no retry.

## Fix

**If requests are being aborted**, the instance ceiling is too low for the
traffic. It was `3` until 2026-09-05, which produced 96 aborted requests in 30
days; it is now `10`. Raise it further if the aborts continue:

```bash
gcloud run services update sgtm --project=iampatterson --region=us-central1 \
  --max-instances=20
```

The ceiling is not a reservation. Cloud Run bills instances that run, so raising
it costs nothing until the traffic needs it.

**If a recent deploy broke it**, roll back. See
[a revision that will not start](revision-will-not-start.md) for the mechanics;
the short version is that you deploy a known-good digest, which is a normal
deploy rather than a special operation.

**If the container itself is unhealthy** and no deploy explains it, check
whether the image is five months stale — see
[updating the sGTM image](sgtm-image-update.md), because the `:stable` tag does
not update on its own.

## How you know it worked

The health endpoint answers, and then, more importantly, data starts arriving
again:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://io.iampatterson.com/healthy

bq query --project_id=iampatterson --nouse_legacy_sql \
  'SELECT COUNT(*) FROM `iampatterson.iampatterson_raw.events_raw`'
```

Run the count, wait, run it again. A health check tells you the service answers
HTTP. Only a rising row count tells you it can still write, which is the thing
that was actually broken.

## Rehearsal

The uptime half of this entry was rehearsed on 2026-09-04 during Phase 12: an
uptime check was pointed at a missing path, the alert fired and was read back
off the Pub/Sub notification channel six minutes later, and the check was
restored. Record: `docs/verification/2026-09-04-uptime-rehearsal.md`.
