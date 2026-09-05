# sGTM container image lifecycle

Deliverable 13.2. The decision, the script, and one real update run end to end on
`sgtm-preview`.

## The measurement that decided it

| | |
| --- | --- |
| What both services declare | `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` |
| What `sgtm` was actually running | `sha256:0f47d392…`, deployed **2026-04-03** |
| What `sgtm-preview` was actually running | `sha256:0f47d392…`, deployed **2026-04-03** |
| What `:stable` resolved to on 2026-09-05 | `sha256:688d35c6…` |

Cloud Run resolves an image tag to a digest when it creates a revision, and the
revision holds that digest for its whole life. So a spec that says `:stable` runs
whatever `:stable` meant on the day of the last deploy — here, five months
earlier. The revision's own `status.imageDigest` is the only honest source; the
service spec reports `:stable` and always will.

## The decision: pin the digest

The floating tag delivered neither thing it appeared to offer. Not currency,
because the runtime had not moved since April. Not legibility, because nothing in
the configuration said which image was serving. Pinning gives up an auto-update
that was never happening, and buys a configuration a person can read.

Recorded in `docs/ARCHITECTURE.md` under "sGTM container lifecycle: pin the
digest". The misleading comment in `infrastructure/terraform/cloud-run.tf`, which
described `:stable` as "Google's recommended auto-updating tag", is corrected in
the same change — it was true as a description of Google's advice and false as a
description of this system's behaviour.

## The script

`infrastructure/sgtm/update-image.sh`

- `status` — what `:stable` resolves to, and for each service the digest it is
  serving, when it was deployed, and `current` or `BEHIND`.
- `[--dry-run] update <sgtm-preview|sgtm>` — deploy the current `:stable` digest
  with a health check either side. A non-200 afterwards exits 2 and prints the
  rollback command with the replaced digest already in it.

Preview is first in the service list by construction, so the rehearsal is never
production.

## The run

**Dry run**

```
service   sgtm-preview
running   sha256:0f47d39232469cd5…
target    sha256:688d35c6c54473be…
health    200 (before)
[dry-run] would deploy …@sha256:688d35c6… to sgtm-preview and re-check health
```

**Real run** — deployed revision `sgtm-preview-00002-q44`, serving 100 % of
traffic.

**After**

```
SERVICE          RUNNING                  DEPLOYED       STATE
sgtm-preview     sha256:688d35c6c54473be  2026-09-05     current
sgtm             sha256:0f47d39232469cd5  2026-04-03     BEHIND
```

| Check | Result |
| --- | --- |
| `sgtm-preview` `/healthy` after the update | 200 |
| `https://io.iampatterson.com/healthy` (production, untouched) | 200 |
| Digest now serving on preview | matches `:stable` |

## Production is deliberately still behind

`sgtm` remains on the 2026-04-03 digest. The deliverable scopes the real run to
`sgtm-preview`, and this session ran unattended: sGTM failing does not announce
itself, it just stops the measurement pipeline while every page still loads. The
preview run is the evidence that the new image is healthy, and updating
production is one command whose outcome a person should be present for.

```bash
bash infrastructure/sgtm/update-image.sh update sgtm
```

That is the outstanding action from this deliverable, and it is recorded as such
in `docs/runbook/sgtm-image-update.md` rather than left as a silent gap.

## Runbook

`docs/runbook/sgtm-image-update.md` is drafted for 13.5 to absorb — the amended
13.2 asks for the entry to be drafted rather than written into a runbook that
depends on 13.2 existing. It carries the tag-is-not-floating explanation, the
commands, the rollback, and how you know it worked.
