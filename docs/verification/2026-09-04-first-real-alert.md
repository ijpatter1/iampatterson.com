# The first real alert

Deliverable 12.4. Written by hand, because the two things it records are the two
a script cannot observe: that a policy fired on a failure nobody staged, and that
the mail arrived.

## What happened

| | |
| --- | --- |
| 2026-09-04T20:40:10Z | Cloud Run aborted the request: `The request was aborted because there was no available instance`, HTTP 500 to `https://data-generator-eb4xrwmo3q-uc.a.run.app/generate` |
| 2026-09-04T20:40:21Z | Cloud Scheduler logged `AttemptFinished`, `status: INTERNAL`, `debugInfo: URL_UNREACHABLE-UNREACHABLE_5xx`, job `data-gen-leadgen` |
| 2026-09-04T20:41:45Z | Cloud Run started an instance, 95 seconds after the request it could not serve |
| 2026-09-04T20:41 | Policy `Cloud Scheduler job attempt failed` matched and notified; the mail reached `ian@tunameltsmyheart.com` |

The policy was created earlier the same day. Nothing was rehearsed: the run at
17:40 local succeeded, this one did not, and the alert arrived unprompted.

## What it proves

**The `conditionMatchedLog` policy kind notifies.** Before this, only threshold
policies had fired — the uptime rehearsal and the proxy capacity rehearsal are
both threshold conditions. Three policies use log matching (Cloud Run container
start failures, Cloud Scheduler, Dataform) and none had ever produced a
notification, which the closing alignment review flagged as the phase's largest
evidentiary gap. This closes it for the kind, on a real failure.

**`ops-email` delivers.** Its `verificationStatus` is unset in the Monitoring
API, so nothing in the machine-generated records established that mail actually
arrived; the uptime rehearsal record inferred it from channel membership. Ian
confirmed receipt on 2026-09-04 of all four rehearsal notifications (uptime open
and recovered, capacity open and recovered) and of this alert. Delivery is
observed, not inferred.

**The alerting caught a failure the operator would otherwise not have seen.** A
single aborted scheduler run leaves no trace a person would look at: the job's
next attempt succeeds, the data is a demo, and nothing downstream complains.

## What it does not prove

The Dataform policy still has no firing of its own, and now cannot get one: the
assertion it depended on is corrected in this phase. Its spec entry carries the
written reason instead. The Cloud Run container-start policy remains unfired by
design.

## The failure itself

The cause is capacity, not correctness. `data-generator` runs with no minimum
instances and `maxScale=10`, and its three Cloud Scheduler jobs fire at :00, :20
and :40 across nine weekday hours, so every run is a cold start. One run in
roughly 135 was aborted before an instance could start.

Seven-day totals for `no available instance`, from the 12.3 `cloud_run_no_instance`
metric: **13 on sgtm, 1 on data-generator**. sGTM is the systematic case and
data-generator the incidental one, but the fix is the same shape and belongs to
13.4, whose wording already requires the scaling settings to be measured before
the services are adopted into declared configuration. This entry is the evidence
for the data-generator half.

Not fixed here: changing scaling is 13.4's work, and one aborted demo run in a
week does not justify pulling it forward.
