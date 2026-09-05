# Dataform assertion failure

**Alert that leads here:** `Dataform workflow invocation failed`.

## What Dataform is doing here

Dataform runs every night at 04:00 UTC. It reads the raw event stream, builds
the staging and mart tables the dashboards read, and then runs assertions —
queries that are supposed to return no rows. An assertion that returns rows has
found something wrong with the data, and the whole workflow invocation is marked
FAILED.

The alert fires on the invocation, not the assertion, so the first job is
finding which of the twenty actions failed.

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

## The question to ask

An assertion failure means one of two things, and they need opposite responses:

**The data is wrong.** Events stopped arriving, a source changed shape, a
generator run failed. Fix the data or the pipeline feeding it.

**The assertion is wrong.** It encodes an expectation that was never true, or
stopped being true for a legitimate reason.

The second is not hypothetical here. `assert_volume_anomaly` failed every night
for a month before 2026-09-04. It counted days with no events across the whole
data range and treated each as a gap, but the data generator only runs on
weekdays, so every weekend counted against it. Six empty days in sixty-one gave a
gap rate of 0.098 against its own threshold of 0.10, and it drifted across that
line as old days aged out. The assertion was wrong, not the data.

It was corrected twice over: the date spine now counts weekdays only, and it is
anchored to `CURRENT_DATE()` rather than to the newest row in the table. That
second change matters more than it sounds. A spine that ends at the last row of
data can never contain a missing day, so a pipeline that stopped dead entirely
would have scored a perfect gap rate forever.

## Fix

If the data is wrong, follow the entry for whatever produced it — most often
[data generator stuck](data-generator-stuck.md).

If the assertion is wrong, edit it under `infrastructure/dataform/definitions/`
on `main` and let the sync action propagate it. **Do not edit the `dataform`
branch.** It is generated: a GitHub Action mirrors `infrastructure/dataform/`
from `main` onto it, and an edit made there is overwritten without warning.

## How you know it worked

The next nightly run at 04:00 UTC completes SUCCEEDED. You do not have to wait
for it — re-run the same invocation query above after triggering a workflow, or
simply check the following morning.

For reference, the corrected assertion first ran on 2026-09-05 and succeeded.

## Rehearsal

Not rehearsed, and it cannot now be. Firing this alert on demand needs a failing
Dataform action, and the one action that failed reliably is the one this project
fixed. `infrastructure/monitoring/apply.sh rehearse-dataform` exists, checks for
a recent failed invocation, finds none, and refuses rather than spending a
production workflow run to manufacture a failure.

The alert has fired for real, nightly, for a month before the fix. Its delivery
path is not in doubt; what is missing is a staged firing, and manufacturing one
would mean deliberately breaking the nightly build of the warehouse.
