# Operational runbook

Every alert this project can raise, and what to do when it does.

Written for someone who has never seen this stack. If an entry assumes you know
what sGTM is, that entry is wrong and should be fixed.

## How to use this

An alert arrives by email at `ian@tunameltsmyheart.com`. Its body names the
policy. Find the policy in the table below, open its entry, and work down the
page: each one is ordered diagnose, then fix, then how you know it worked.

If you are here without an alert, the entries still read as explanations of how
each part of the system fails.

## Alert to entry

Sixteen alerts: eleven policies in `infrastructure/monitoring/spec/policies.json`
plus one per uptime check in `uptime.json`.

| Alert | Entry |
| --- | --- |
| Cloud Run 5xx: more than 10 in 5 minutes on any service | **read `service_name` first** → [sGTM](sgtm-not-responding.md) · [event-stream](event-pipeline-backlog.md) · [claudish-proxy](claudish-proxy-over-budget.md) · [data-generator](data-generator-stuck.md) · [metabase](uptime-check-failing.md) |
| Cloud Run instance aborts: 'no available instance' on any service | **read `service_name` first** → [sGTM](sgtm-not-responding.md) · [data-generator](data-generator-stuck.md) · others as above |
| Cloud Run container failed to start or crash-looped | [a revision that will not start](revision-will-not-start.md) |
| Pub/Sub backlog on iampatterson-events-push: oldest unacked message older than 5 minutes | [event pipeline backlog](event-pipeline-backlog.md) |
| Pub/Sub backlog on iampatterson-events-push: more than 100 undelivered messages | [event pipeline backlog](event-pipeline-backlog.md) |
| Cloud Scheduler job attempt failed | [data generator stuck](data-generator-stuck.md) |
| Dataform workflow invocation failed | [Dataform assertion failure](dataform-assertion-failure.md) |
| BigQuery billed scan above 1 TB in a day | [BigQuery spend](bigquery-spend.md) |
| Claudish proxy budget threshold crossed (50/80/100 %) | [Claudish proxy over budget](claudish-proxy-over-budget.md) |
| Claudish proxy refusing for capacity | [Claudish proxy over budget](claudish-proxy-over-budget.md) |
| TLS certificate expiring within 14 days on a monitored surface | [certificate renewal failure](certificate-renewal-failure.md) |
| Uptime `sgtm-healthy` failing | [sGTM not responding](sgtm-not-responding.md) |
| Uptime `event-stream-health` failing | [event pipeline backlog](event-pipeline-backlog.md) |
| Uptime `claudish-proxy-health` failing | [Claudish proxy over budget](claudish-proxy-over-budget.md) |
| Uptime `site-www` failing | [a public surface is down](uptime-check-failing.md) |
| Uptime `metabase-lb` failing | [a public surface is down](uptime-check-failing.md) |

### Two alerts cover every service

`Cloud Run 5xx` and `Cloud Run instance aborts` both fire on **any** service, so
the entry you want depends on which one. The alert body carries
`resource.labels.service_name`; read it before following a link. This matters:
the abort alert is the one that has actually fired unprompted in this project,
and it fired on `data-generator`, not on sGTM.

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND textPayload:"no available instance"' \
  --project=iampatterson --limit=10 --freshness=1h \
  --format='value(timestamp, resource.labels.service_name)'
```

## Entries with no alert

Things that go wrong without anything watching for them.

| Situation | Entry |
| --- | --- |
| A Vercel build fails on a runtime deprecation | [Vercel build failing](vercel-build-failing.md) |
| Your gcloud credentials expire mid-incident | [expired gcloud credentials](expired-gcloud-credentials.md) |
| An automated check cannot read a Vercel preview | [preview protection](preview-protection.md) |
| Scheduled maintenance: the sGTM container image | [updating the sGTM image](sgtm-image-update.md) |
| Scheduled maintenance: dependencies | [dependency cadence](dependency-cadence.md) |
| Someone needs access to Metabase, or everyone is getting 403 | [Metabase access](metabase-access.md) |

## Things to know before you start

**Every gcloud command needs `--project=iampatterson`.** The CLI's default
project on this machine is a different one, and a command that omits the flag
will quietly operate on the wrong project or fail confusingly.

**Credentials expire roughly hourly and overnight.** If a command fails with a
reauthentication error, that is normal and it is not the incident. See
[expired gcloud credentials](expired-gcloud-credentials.md).

**Nothing here deletes data.** Where an entry could, it says so and stops.
