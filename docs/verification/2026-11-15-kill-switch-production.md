# Kill switch, exercised in production, 2026-11-15

Run by Claude with Ian present, from `fix/kill-switch` (`6f6e838`) before merge, after the 2026-11-15 finding that the old single-command switch made a revision serving 0%.

## Before

`claudish-proxy-00035-z47` served 100%. `/health`: `{"capped":false,"budgetUsedPct":0}`.

## On: `scripts/deploy-cloud-run.sh kill-switch claudish-proxy on`

- Built `claudish-proxy-env-1115214031` on the serving image (`sha256:f2299fc3d57f…`, unchanged), no traffic. Diff: `env.KILL_SWITCH: 'off' -> 'on'`, 0 unexpected changes (`deploys/claudish-proxy-env-1115214031.diff`).
- Promoted it, `/health` 200 on it, and the script confirmed `claudish-proxy-env-1115214031 serves 100% with KILL_SWITCH=on`.
- In the running process: `/health` answered `{"capped":true}`. A new en2cl translation answered **503**.
- A translation that an earlier revision had cached also answered 503. The response cache is in each instance's memory, and the switch starts a new revision with empty caches. The README's "cache hits still serve" is corrected.

## Off: `scripts/deploy-cloud-run.sh kill-switch claudish-proxy off`

- Built `claudish-proxy-env-1115214118`. Diff: `env.KILL_SWITCH: 'on' -> 'off'`, 0 unexpected changes (`deploys/claudish-proxy-env-1115214118.diff`).
- Promoted it and confirmed `serves 100% with KILL_SWITCH=off`. `/health` answered `{"capped":false}`, and a new translation streamed with HTTP 200.

## What it proved, and what it left

- Real gcloud accepts `run deploy --image <digest> --revision-suffix … --update-env-vars ^@^… --no-traffic` on this source-deployed service.
- The switch reaches traffic and the serving process refuses spend, both ways.
- `--revision-suffix` leaves its name on the service template (`spec.template.metadata.name`). So `deploy` and `setup.sh` now name their revisions too, rather than rely on gcloud generating a fresh name next time.
- The `--remove-env-vars` path wasn't exercised: the template and serving env matched, so nothing needed removing.
- Each switch resets the day's in-memory spend, as the runbook says.
