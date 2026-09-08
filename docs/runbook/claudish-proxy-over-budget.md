# Claudish proxy over budget or misbehaving

**Alerts that lead here:** `Claudish proxy budget threshold crossed
(50/80/100 %)`, `Claudish proxy refusing for capacity`, and the uptime check
`claudish-proxy-health`.

## What it is

`/claudish` is a translator between English and the register Claude writes in.
It is fronted by a Cloud Run service, `claudish-proxy`, which calls a model and
streams tokens back. It is the one part of this site that costs money per
request, so it is the one part with a spending control built into it.

## Read the alert first

The three alerts mean different things and only one is a problem.

**`budget threshold crossed` at 50 % or 80 %** is informational. The proxy is
telling you how much of its daily allowance it has used. It happens on a busy
day and needs no action.

**`budget threshold crossed` at 100 %, or `refusing for capacity`**, means the
proxy has tripped itself to cache-only. New translations are refused with a
deliberate message; cached ones still return. The site works, the toy does not.
This resets at UTC midnight on its own.

**The uptime check failing** means the service is genuinely unreachable, which is
a different problem — go to
[a revision that will not start](revision-will-not-start.md).

## Diagnose

What has it been doing?

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="claudish-proxy"
   AND jsonPayload.event=("budget_threshold" OR "capacity_no_budget")' \
  --project=iampatterson --limit=20 --freshness=24h \
  --format='value(timestamp, jsonPayload.event, jsonPayload.budgetUsedPct)'
```

Is it serving at all?

```bash
URL=$(gcloud run services describe claudish-proxy --project=iampatterson \
  --region=us-central1 --format='value(status.url)')
curl -s -o /dev/null -w '%{http_code}\n' "$URL/health"
```

The logs never contain input or output text. That is enforced, not incidental: no
translated content, no cache-key preimages, no model error strings that could
embed a request body. If you are trying to debug a specific bad translation, the
logs will not have it, by design.

## Fix

**If it tripped on budget**, decide whether that is correct behaviour. It usually
is — the cap exists so a busy day cannot become an expensive one. It clears at
UTC midnight. If you want it back sooner, the daily allowance is an environment
variable, and raising it is a deliberate spending decision:

```bash
# from infrastructure/cloud-run/claudish-proxy/
MODEL_ID_CONFIRMED=1 bash setup.sh
```

**If it is misbehaving — bad output, a runaway, anything you want stopped now —
use the kill switch.** This forces cache-only immediately:

```bash
gcloud run services update claudish-proxy --project=iampatterson \
  --region=us-central1 --update-env-vars KILL_SWITCH=on
```

The switch survives deploys, which is the point: a redeploy in the middle of an
incident must not quietly re-enable the thing you just turned off. Turn it back
off the same way with `KILL_SWITCH=off`, and remember that you must, because
nothing will do it for you.

**If a bad revision is the cause**, roll back with
`scripts/deploy-cloud-run.sh promote claudish-proxy <revision>`.

## Before you call it fixed: the golden gate

The proxy has a golden suite — a set of translations with property assertions
rather than exact matches, checking that Claudish output carries the tics it
should and that English output does not. It is the gate before and after any
change to the proxy:

```bash
bash scripts/run-claudish-golden.sh
```

Run it after a rollback or a configuration change. A service that answers 200 and
translates badly is still broken, and the health endpoint cannot tell you that.

## How you know it worked

The health endpoint answers, the golden gate passes, and a real translation
completes end to end at `https://www.iampatterson.com/claudish`. If you used the
kill switch, confirm it is off:

```bash
gcloud run services describe claudish-proxy --project=iampatterson \
  --region=us-central1 --format='value(spec.template.spec.containers[0].env)'
```

## Rehearsal

Rehearsed on 2026-09-04. `infrastructure/monitoring/apply.sh rehearse-policy`
turned the kill switch on, requested one translation which was refused with HTTP
503, turned the switch off 109 seconds later, and read the resulting alert off
the Pub/Sub notification channel two minutes after that. The switch goes off as
soon as the refusal is logged, because the log entry is what fires the alert, so
the live site is not held in a refusing state for the length of the wait.
Record: `docs/verification/2026-09-04-policy-rehearsal.md`.
