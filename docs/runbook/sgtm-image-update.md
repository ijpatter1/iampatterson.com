# Updating the sGTM container image

> Drafted by 13.2 for 13.5 to absorb into the runbook's index. The procedure is
> complete and rehearsed; what 13.5 adds is the surrounding structure and the
> link from the alert that leads here.

**Alert that leads here:** none directly. This is scheduled maintenance, driven
by the cadence in `docs/runbook/dependency-cadence.md` (13.3), not by a failure.
The alert you would see if an update went wrong is *Cloud Run container failed to
start or crash-looped* on `sgtm`, whose procedure is the rollback at the bottom.

## What you need to know first

`gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` looks like an
auto-updating tag. It is not one, and this is the single most important fact on
this page.

Cloud Run resolves an image tag to a digest when it creates a revision, and the
revision holds that digest for its whole life. A service whose spec says
`:stable` therefore runs whatever `:stable` happened to mean on the day it was
last deployed, forever, with nothing in the configuration saying so. Measured on
2026-09-05: `sgtm` and `sgtm-preview` had both been deployed on 2026-04-03 and
were still running `sha256:0f47d392…`, while `:stable` had long since moved to
`sha256:688d35c6…`. Five months of container updates had not arrived.

So the tag gives you neither of the things a tag is supposed to give you. You do
not get updates, and you cannot read what you are running.

## Check what is running

```bash
bash infrastructure/sgtm/update-image.sh status
```

Prints the digest `:stable` resolves to today, and for each service the digest it
is actually serving (read from the live revision, not the spec), when it was
deployed, and whether it is `current` or `BEHIND`.

## Update

Always preview first. It serves no production traffic, so its health after the
update is the evidence that the image works before the real one follows.

```bash
bash infrastructure/sgtm/update-image.sh --dry-run update sgtm-preview   # look
bash infrastructure/sgtm/update-image.sh update sgtm-preview             # do
```

The script checks `/healthy` before and after. A non-200 afterwards exits 2 and
prints the exact rollback command for the digest it replaced.

Then, once preview has been healthy for as long as you want to wait:

```bash
bash infrastructure/sgtm/update-image.sh update sgtm
```

## If it goes wrong

The script prints the rollback command with the previous digest already filled
in. It looks like this:

```bash
gcloud run deploy sgtm --project=iampatterson --region=us-central1 \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image@sha256:<the old digest>
```

Rolling back is a normal deploy of a known-good digest, not a special operation.
Cloud Run keeps the old revision, so the previous digest is always recoverable
from `gcloud run revisions list --service=sgtm --project=iampatterson --region=us-central1`.

## How you know it worked

`https://io.iampatterson.com/healthy` returns 200, and the uptime check
`sgtm-healthy` stays green. Beyond that, the real test is that events keep
arriving: `iampatterson_raw.events_raw` should keep gaining rows on a weekday,
and the *Cloud Run 5xx* and *Pub/Sub backlog* alerts should stay quiet.

## What actually happened on 2026-09-05, and the lesson in it

This page originally closed by saying production `sgtm` was still on the
2026-04-03 digest and that updating it was the outstanding action. That is no
longer true, and *how* it stopped being true is the most useful thing on this
page.

Production was upgraded **by accident**. A any `gcloud run services update` (whatever its flags) that
changed `--max-instances` created revision `sgtm-00015-kdj`, and because the
service spec held the *tag* `:stable` rather than a digest, the new revision
re-resolved that tag to whatever it pointed at that day. Five months of container
updates arrived as a side effect of a scaling change. Nobody reviewed it and
nobody decided it.

That is exactly the risk the pin decision was written to remove, and it happened
within hours of the decision being recorded — which is the clearest possible
argument that a floating tag in a service spec is not a passive default. **Any**
service update re-resolves it.

Both services now declare an explicit digest, in the live spec and in
`infrastructure/terraform/cloud-run.tf`. An unrelated `gcloud run services
update` can no longer move the image. Updates happen when someone runs the
command in this page.

| | |
| --- | --- |
| Serving digest, both services | `sha256:688d35c6…` |
| Pinned explicitly | 2026-09-08 |
| Production health after pinning | `io.iampatterson.com/healthy` 200 |
