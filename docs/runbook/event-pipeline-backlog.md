# Event pipeline backlog

**Alerts that lead here:** `Pub/Sub oldest unacked message older than 5 minutes`,
`Pub/Sub more than 100 undelivered messages`, `Cloud Run 5xx` on `event-stream`,
and the uptime check `event-stream-health`.

## What the pipeline is

sGTM publishes each measurement event to a Pub/Sub topic,
`iampatterson-events`. A push subscription, `iampatterson-events-push`, delivers
each message over HTTP to the `event-stream` Cloud Run service, which holds open
Server-Sent Events connections so a visitor can watch their own session move
through the pipeline in real time.

A backlog means Pub/Sub has messages it cannot hand to `event-stream`. The
website is unaffected and the warehouse is unaffected; what breaks is the live
overlay, which is the demonstration the site is built around.

## Diagnose

How far behind is it?

```bash
gcloud pubsub subscriptions describe iampatterson-events-push \
  --project=iampatterson --format='value(pushConfig.pushEndpoint, ackDeadlineSeconds)'
```

Is the consumer alive?

```bash
EVENT_STREAM=$(gcloud run services describe event-stream --project=iampatterson \
  --region=us-central1 --format='value(status.url)')
curl -s -o /dev/null -w '%{http_code}\n' "$EVENT_STREAM/health"
```

If the push endpoint in the subscription does not match that service URL, the
subscription is delivering into nothing. That happens when a service is recreated
and gets a new hostname.

What is it complaining about?

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="event-stream"
   AND severity>=ERROR' \
  --project=iampatterson --limit=20 --freshness=1h
```

## Fix

**If `event-stream` is unhealthy**, the backlog is a symptom. Fix the service and
the backlog drains by itself — Pub/Sub retries with backoff between 10 and 600
seconds.

**If the push endpoint is wrong**, point it at the live URL:

```bash
gcloud pubsub subscriptions update iampatterson-events-push \
  --project=iampatterson --push-endpoint="$EVENT_STREAM/pubsub/push"
```

**If one message is poisoning delivery**, read the next section, because this is
where the runbook stops being able to help.

## The gap you should know about

**There is no dead-letter topic.** A message `event-stream` cannot process is
retried until it either succeeds or reaches the subscription's seven-day message
retention, and then it is discarded. There is no queue of failed messages to
inspect afterwards and nothing to replay.

This is the live shape of the system, recorded rather than quietly worked
around. `infrastructure/terraform/pubsub.tf` declares the subscription without
one and a test asserts that absence, so it cannot drift away unnoticed.

The practical consequence during an incident: if you believe a specific message
is the problem, you cannot quarantine it. Your options are to fix the consumer so
it accepts the message, or to wait out the retention. Adding a dead-letter topic
is a real improvement and a deliberate design decision, not something to do
mid-incident.

## How you know it worked

The oldest unacked age falls back toward zero and the alert closes on its own.
Confirm the overlay works by opening the site and watching an event appear.

## Rehearsal

Not rehearsed. A backlog is produced by breaking the consumer, and the only
honest way to do that is to stop `event-stream` while it is serving live SSE
connections to whoever is on the site. The failure mode is well understood from
its parts — the alert fired for real during Phase 12 capacity work — and the
diagnosis above is exercised by the same commands used to verify normal
operation. Written reason rather than a staged outage.
