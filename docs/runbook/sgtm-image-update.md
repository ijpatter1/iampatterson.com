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
from `gcloud run revisions list --service=sgtm`.

## How you know it worked

`https://io.iampatterson.com/healthy` returns 200, and the uptime check
`sgtm-healthy` stays green. Beyond that, the real test is that events keep
arriving: `iampatterson_raw.events_raw` should keep gaining rows on a weekday,
and the *Cloud Run 5xx* and *Pub/Sub backlog* alerts should stay quiet.

## Open at the time of writing

`sgtm` in production is still on the 2026-04-03 digest. 13.2 rehearsed the update
on `sgtm-preview` only, deliberately: the deliverable scopes the real run to
preview, and sGTM failing takes the measurement pipeline with it quietly. Running
the third command above is the outstanding action, and it is a person's call.
