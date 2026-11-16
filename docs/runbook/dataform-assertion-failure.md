# Dataform assertion failure

**Alert that leads here:** `Dataform workflow invocation failed`.

## What Dataform is doing here

Dataform runs every night at 04:00 UTC. It reads the raw event stream, builds
the staging and mart tables the dashboards read, and then runs assertions —
queries that are supposed to return no rows. An assertion that returns rows has
found something wrong with the data, and the whole workflow invocation is marked
FAILED.

The alert fires on the invocation, not the assertion, so the first job is
finding which of the six actions failed (three tables, three assertions, since
18.1 thinned the set on 2026-11-15; runs before that had twenty).

## Diagnose

Find the most recent invocations. The API does not return them in time order, so
sort them:

```bash
TOK=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOK" \
  "https://dataform.googleapis.com/v1/projects/iampatterson/locations/us-central1/repositories/iampatterson-dataform/workflowInvocations?pageSize=200" \
| python3 -c "
import json,sys
ws=[(w.get('invocationTiming',{}).get('startTime',''), w.get('state'), w['name'].split('/')[-1])
    for w in json.load(sys.stdin).get('workflowInvocations',[])]
for t,s,n in sorted(ws, reverse=True)[:5]: print(t, s, n)"
```

Then ask that invocation which action failed, replacing `<id>`:

```bash
curl -s -H "Authorization: Bearer $TOK" \
  "https://dataform.googleapis.com/v1/projects/iampatterson/locations/us-central1/repositories/iampatterson-dataform/workflowInvocations/<id>:query" \
| python3 -c "
import json,sys
for a in json.load(sys.stdin).get('workflowInvocationActions',[]):
    if a.get('state') not in ('SUCCEEDED','SKIPPED'):
        print(a['target'].get('name'), a.get('state'), (a.get('failureReason') or '')[:200])"
```

The assertions live in `infrastructure/dataform/definitions/assertions/`. Open
the one that failed and read the query. Each is a `SELECT` that should return
nothing.

## If no action failed

The query above can come back with **zero actions**. That is not a broken query;
it means the invocation failed before it ran anything, so no assertion is
involved and nothing in the next section applies.

Check the invocation's own record and its compilation result:

```bash
curl -s -H "Authorization: Bearer $TOK" \
  "https://dataform.googleapis.com/v1/projects/iampatterson/locations/us-central1/repositories/iampatterson-dataform/workflowInvocations/<id>" \
| python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state'), d.get('invocationTiming'))"
```

A start and end time seconds apart, with `compilationErrors: 0` on the resolved
compilation result, means the invocation failed at the platform rather than in
your code. There is no fix to make and nothing to correct in the repository.

**This happened on 2026-09-07.** The run failed 29 seconds in, having executed
none of its twenty actions, with a clean compilation and no detail in the audit
log. The runs either side of it — 09-06 and 09-08 — both succeeded. Treat a
single occurrence as transient and let the next night's run be the check; a
second consecutive one is a real signal and worth escalating.

The trap this section exists to prevent: reading "workflow invocation failed" and
going straight to the assertions, finding nothing wrong with them, and concluding
the alert is broken. The alert is correct. The invocation did fail. It simply
failed somewhere the assertions are not.

## The question to ask

An assertion failure means one of two things, and they need opposite responses:

**The data is wrong.** Real events stopped arriving or a source changed
shape. Fix the data or the pipeline feeding it.

**The assertion is wrong.** It encodes an expectation that was never true, or
stopped being true for a legitimate reason.

The second is not hypothetical here. `assert_volume_anomaly` failed every night
for a month before 2026-09-04. It counted days with no events across the whole
data range and treated each as a gap, but the data generator only runs on
weekdays, so every weekend counted against it. Six empty days in sixty-one gave a
gap rate of 0.098 against its own threshold of 0.10, and it drifted across that
line as old days aged out. The assertion was wrong, not the data.

It was corrected twice over: the date spine came to count weekdays only, and it was
anchored to `CURRENT_DATE()` rather than to the newest row in the table. That
second change matters more than it sounds. A spine that ends at the last row of
data can never contain a missing day, so a pipeline that stopped dead entirely
would have scored a perfect gap rate forever.

Both checks were wrong again for real traffic, and 18.1 (2026-11-15) dealt with
them before the generator stops. `assert_volume_anomaly` is removed: it modelled
the generator's weekday schedule, and on real traffic 12 of 21 weekdays had no
event. `assert_source_freshness` had been failing on most Sundays and Mondays
because its 24-hour window did not tolerate the generator's idle weekend; it now
counts real events only, by arrival time, and fails after ten days without
one. Over the 60 nightly runs to 2026-11-15, the longest real-traffic gap was
7.4 days. The reasoning is in the assertion's own comment.

## Fix

If the data is wrong, find where real events stopped. Since 18.1 no remaining
check reads the generator's rows, so a failure is never the generator. A
freshness or real-session failure means either no real visitor reached
BigQuery for the window, or sGTM stopped writing to BigQuery. To tell them
apart:

1. Visit `https://www.iampatterson.com`, allow analytics, and watch the
   overlay: if your events appear there, the browser and sGTM are fine.
2. Then query `events_raw` for rows with your session ID. Rows present: it
   was a genuinely quiet spell. Overlay events but no rows: the server
   container's BigQuery tag, or the `sgtm-runtime` account's BigQuery grants,
   are broken.

If the assertion is wrong, edit it under `infrastructure/dataform/definitions/`
on `main` and let the sync action propagate it. **Do not edit the `dataform`
branch.** It is generated: a GitHub Action mirrors `infrastructure/dataform/`
from `main` onto it, and an edit made there is overwritten without warning.

## How you know it worked

The next nightly run at 04:00 UTC completes SUCCEEDED. You do not have to wait
for it — re-run the same invocation query above after triggering a workflow, or
simply check the following morning.

For reference, the retuned checks (18.1, 2026-11-15) leave three assertions,
none of which reads generator rows.

## Rehearsal

Not rehearsed. Firing this alert on demand needs a failing Dataform action.
`infrastructure/monitoring/apply.sh rehearse-dataform` checks for a recent
failed invocation and, if there is one, re-runs `assert_source_freshness` alone
to reproduce it; on a healthy site there is none, and it refuses rather than
spending a production workflow run to manufacture a failure.

The alert has fired for real, nightly, for a month before the fix. Its delivery
path is not in doubt; what is missing is a staged firing, and manufacturing one
would mean deliberately breaking the nightly build of the warehouse.
