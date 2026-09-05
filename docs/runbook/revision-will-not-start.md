# A revision that will not start

**Alert that leads here:** `Cloud Run container failed to start or crash-looped`.

## What has happened

A deploy produced a container that Cloud Run could not bring up. Cloud Run does
not route traffic to a revision that fails its startup probe, so in most cases
the previous revision keeps serving and the site stays up. The alert is telling
you a deploy failed, not necessarily that anything is down.

Check which it is before doing anything else.

## Diagnose

Is the service still serving, and from what?

```bash
gcloud run services describe <service> --project=iampatterson --region=us-central1 \
  --format='value(status.traffic[0].revisionName, status.latestCreatedRevisionName)'
```

Two different values means the new revision was created and traffic stayed on the
old one. That is the safe case.

Why did it fail?

```bash
gcloud run revisions describe <new-revision> --project=iampatterson \
  --region=us-central1 --format='value(status.conditions)'
```

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.revision_name="<new-revision>"' \
  --project=iampatterson --limit=50 --freshness=1h --format='value(textPayload)'
```

The usual causes are a container that exits immediately, a missing environment
variable or secret, or a service account that lost a permission the container
needs at startup.

## Fix: roll back

Rolling back is a normal deploy of a known-good revision, not a special
operation. Cloud Run keeps old revisions, so the previous one is always there.

Find it:

```bash
gcloud run revisions list --service=<service> --project=iampatterson \
  --region=us-central1 --format='value(name, metadata.creationTimestamp)' --limit=5
```

Then route traffic back to it:

```bash
scripts/deploy-cloud-run.sh promote <service> <known-good-revision>
```

That script routes all traffic to the exact revision you name and checks the
service's health endpoint afterwards. It is the same path a normal promotion
takes, which is deliberate: the rollback procedure is not a rarely-exercised
special case.

For the sGTM services, whose images are pinned digests rather than built from
source, `infrastructure/sgtm/update-image.sh` prints the exact rollback command
with the previous digest already filled in whenever an update fails its health
check.

## How you know it worked

The health endpoint answers and traffic is on the revision you expect:

```bash
gcloud run services describe <service> --project=iampatterson --region=us-central1 \
  --format='value(status.traffic[0].revisionName)'
```

For `sgtm` and `data-generator`, confirm data is still flowing as well — see
[sGTM not responding](sgtm-not-responding.md) for the row-count check. A service
can answer HTTP 200 and still be unable to write.

## Then find out why

A rollback restores service; it does not explain anything. The failed revision is
still there and still describable. Read its logs before deploying again, or you
will deploy the same fault.

## Rehearsal

Rehearsed on 2026-09-05 on `sgtm-preview`, which serves no production traffic.

`gcr.io/google-containers/pause:3.2` was deployed to it deliberately — a
container that starts and never listens on a port. Cloud Run created revision
`sgtm-preview-00004-kxh`, and:

```
Default STARTUP TCP probe failed 1 time consecutively for container "pause-1"
on port 8080. The instance was not started.
Connection failed with status DEADLINE_EXCEEDED.
```

```
Ready  Unknown  Retrying container health check; still waiting to become
healthy. Startup probe timed out after 4m.
```

**Traffic never moved.** `sgtm-preview-00003-jjh` kept serving throughout and
`/healthy` answered 200 the whole time, which is the point this entry opens with:
the alert tells you a deploy failed, not that anything is down.

Rolling back was an ordinary deploy of the previous digest, producing revision
`sgtm-preview-00005-vkq`, healthy at 200. Total elapsed from breaking it to
restored: under ten minutes, four of which were the startup probe's own timeout.

One detail worth carrying: the failed revision is still there and still
describable. `gcloud run revisions describe sgtm-preview-00004-kxh` returns its
condition and its logs after the rollback, which is what makes the "then find out
why" section above possible rather than aspirational.
