# The operational runbook

Deliverable 13.5. Twelve entries, an index, and the rehearsals behind them.

## Acceptance, clause by clause

| Clause | Result |
| --- | --- |
| Every one of the sixteen Phase 12 alerts links to an entry | met, and asserted by test |
| One dated rehearsal per entry, or a written reason it cannot be rehearsed safely | met, 9 rehearsed and 3 reasoned |
| The manual task card for the Vercel bypass secret exists | met, `docs/manual/task-2026-09-05-001.md` |

Sixteen alerts: the eleven policies in
`infrastructure/monitoring/spec/policies.json` plus one per uptime check.
`tests/unit/infra/runbook.test.ts` fails if any alert points at nothing, if any
entry becomes unreachable from the index, or if an entry loses its verification
or rehearsal section.

## The four entries that exist because the boundary review found them

13.5's original wording listed nine failure modes and bound itself to every Phase
12 alert. Four alerts had no entry to link to, and one of the gaps was a
procedure the spec had asked for and the requirement had dropped:

- **a revision that will not start** — the crash-loop policy pointed at "roll back
  to the previous revision", which no entry described. The spec's deliverable 8
  wrote "Claudish proxy over budget or misbehaving *(kill switch, revert to a
  previous revision, the golden gate)*"; the requirement kept the phrase and lost
  the parenthetical, deleting the only home for a procedure two policies referenced.
- **BigQuery spend** — the daily-scan policy pointed at "13.5 and 13.1", and
  neither produced a procedure.
- **a public surface is down** — the `site-www` and `metabase-lb` uptime alerts had
  nothing; the nearest entry was a *build* failure, which is a different event
  from an outage.

Caught while the phase was open and amended then, which is what the 12.3 erratum
asks future deliverables to do.

## Rehearsals

**Nine rehearsed.** Four inherited from Phase 12's real firings (uptime, the
Claudish capacity trip, the Dataform nightly failure, the first real alert), and
five performed for this deliverable:

| Entry | What was done |
| --- | --- |
| a revision that will not start | `gcr.io/google-containers/pause:3.2` deployed to `sgtm-preview`; startup TCP probe failed on 8080, revision `00004` never became Ready, **traffic never moved**, `/healthy` stayed 200. Rolled back to the known-good digest as an ordinary deploy. |
| a public surface is down | `site-www` pointed at a missing path; probes fell to 0.00 for six continuous minutes against a `60s` policy duration, then recovered on restore. The site served 200 throughout. |
| data generator stuck | invoked twice under a changed identity during 13.4; 712 events then 117, and `events_raw` rose by exactly those amounts. |
| preview protection | the live PR #62 preview returned `302` to `vercel.com/sso-api` and on to a login page. |
| expired gcloud credentials | happened for real, mid-session, on 2026-09-05. |

**Three reasoned rather than staged**, each naming what a rehearsal would cost:
scanning a terabyte of BigQuery, failing a certificate renewal on demand, or
manufacturing a Dataform failure by breaking the nightly warehouse build.

## Two corrections the rehearsals forced

**`preview-protection.md` said the wall returns `401`.** It returns **`302`**,
redirecting to a login page that itself returns `200`. A naive check is misled
twice — the first response is not an error, and following redirects yields a
success. The entry now says so and reads the body rather than the status.

**The index paraphrased two alert names.** An operator arriving from an email
matches on the policy's display name, so the table now carries those verbatim
rather than a readable summary.

## What the uptime rehearsal did not prove

The rehearsal script reads its own alert back off the Pub/Sub channel. Its read
timed out client-side while waiting for the recovery notification, and the
subscription was empty afterwards — consistent with the OPEN notification having
been pulled and acknowledged first, but not proof of it. The firing is therefore
established from the probe series and the policy configuration, not from the
notification.

Two properties came out of that failure anyway. The script restored the check
even though it crashed, because the restore sits in a `finally` block — a crashed
rehearsal left production monitoring correct. And the run was captured through
`tail`, which discarded everything but the traceback; a rehearsal's log is
evidence and should be captured whole. That is a defect in how it was invoked,
not in the script.

## Recorded gaps, not omissions

The push subscription has **no dead-letter topic**, so a message `event-stream`
cannot process has no recovery path beyond draining the backlog or waiting out
the seven-day retention. The backlog entry says so as a limitation of its own
procedure, and `infrastructure/terraform/pubsub.tf` pins the absence.

## Checks

1,999 tests across 179 suites, `npm run lint` clean. The runbook is 1,369 lines
across thirteen files plus the two maintenance pages 13.2 and 13.3 drafted.
