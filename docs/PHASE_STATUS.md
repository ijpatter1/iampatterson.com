# Phase Status Tracker

> **Current Phase: 12 — Runtime currency and observability**
> Last updated: 2026-09-04, session-2026-09-04-001 (12.1 complete)
>
> **Amendments:**
> - 2026-09-04 — deps-amend [12.1] (session-2026-09-04-001) — names the real Node references (CLAUDE.md facts, both Docker stages, ARCHITECTURE), adds the toolchain note, records that the workflow pins no Node (alignment finding 1)
> - 2026-09-04 — deps-amend [12.2] (session-2026-09-04-001) — checks declared under infrastructure/monitoring/ and applied by apply.sh, every check alerting, the io.iampatterson.com host named (alignment finding 5)
> - 2026-09-04 — deps-amend [12.3] (session-2026-09-04-001) — metrics scoped to the events the services actually emit, event-stream silence recorded, log retention provisional until 13.1 (alignment findings 2 and 3)
> - 2026-09-04 — deps-amend [12.4] (session-2026-09-04-001) — exact proxy event names, the push subscription, crash loops, and who creates the metrics (alignment finding 8)
> - 2026-09-04 — deps-amend [12.5] (session-2026-09-04-001) — the proxy panel shows budget threshold crossings, the only budget signal the proxy logs (alignment finding 4)

---

## Phase 12 — Runtime currency and observability

_Goal: Meet the Node 24 deadline and stand up the monitoring foundation: a notification channel, uptime checks, log-based metrics, alerting policies and a dashboard, all as committed configuration applied by script._

- ✅ **[12.1]** Node.js 24 runtime: pin `engines.node` to `24.x`, move both stages of the three Cloud Run Dockerfiles to `node:24-slim`, record the Node 24 pin and the Homebrew arm64 toolchain note in the CLAUDE.md project facts (retiring the "Runtime deadline" fact), update the Node references in ARCHITECTURE, and confirm the sync-dataform workflow pins no Node; all suites and the proxy golden gate pass under Node 24, the Vercel production build carries no deprecation warning, and the three services are redeployed on the new image with healthy endpoints `[deps: none]` ✅ 2026-09-04, session-2026-09-04-001, record `docs/verification/2026-09-04-node24-runtime.md`
- ⬜ **[12.2]** Notification channel and uptime checks: an email channel (Slack optional) and Cloud Monitoring uptime checks on sGTM `https://io.iampatterson.com/healthy`, event-stream `/health`, claudish-proxy `/health`, `https://www.iampatterson.com/` and the Metabase load balancer (the IAP redirect counts as healthy), every check alerting to the channel, all declared under `infrastructure/monitoring/` and applied by `apply.sh`, with one deliberate failure rehearsed and its notification recorded `[deps: none]`
- ⬜ **[12.3]** Log-based metrics and retention: metrics for the structured error events the proxy already emits (`request_error`, `loop_fell_through`, `loop_retry_failed`, `loop_empty_result`, `loop_failed_midstream`, `lane_failed`, `capacity_ladder_exhausted`) and for data-generator's `[ad-insert]` failure line, a recorded note that event-stream emits no error logs today, a provisional retention period for the `_Default` log bucket to be confirmed against the 13.1 data retention decision, a sink if anything must outlive it, and one "what failed in the last 24 hours" query each for sGTM, event-stream, data-generator and claudish-proxy for the runbook `[deps: none]`
- ⬜ **[12.4]** Alerting policies routed to the channel: Cloud Run 5xx rate per service, container restarts and crash loops, Pub/Sub oldest unacked age and undelivered count on the push subscription, Cloud Scheduler job failures, Dataform run failures, BigQuery daily spend, the claudish-proxy `budget_threshold` and `capacity_no_budget` log events, and managed certificate expiry, each with a documented threshold, any log-based metric it needs, and either a recorded test firing or a written reason it cannot be fired safely `[deps: 12.2, 12.3]`
- ⬜ **[12.5]** Cloud Monitoring dashboard generated from a committed spec under `infrastructure/monitoring/` and applied by script: request rate, latency and error rate per Cloud Run service, Pub/Sub throughput and backlog, BigQuery slot usage and daily cost, scheduler outcomes, certificate status and the proxy's per-instance budget threshold crossings (`budget_threshold` at 50/80/100 %) `[deps: 12.4]`

---

## Phase 13 — Cost, lifecycle and the runbook

_Goal: Put retention and cost controls in place, decide the sGTM image lifecycle, adopt the Cloud Run services into declared identity and configuration, set a dependency cadence, and write the runbook that ties every alert to a procedure._

- ⬜ **[13.1]** Retention and cost controls: measure partition expiration on every raw and staging table, table sizes, GCS lifecycle rules and Dataform schedule state; then apply partition expiration on raw event tables, lifecycle rules on the AI export bucket, a notification channel on the existing project budget, and a Vertex spend budget for the Claudish proxy if the in-app cap is not enough on its own `[deps: 12.2]`
- ⬜ **[13.2]** sGTM container lifecycle: a recorded decision between the floating `:stable` tag and a pinned digest, and an operator script with a dry run that updates `gtm-cloud-image` on `sgtm` and `sgtm-preview`, rehearsed once end to end on `sgtm-preview` `[deps: none]`
- ⬜ **[13.3]** Dependency update process: a documented cadence for Node, Next.js and React, Cloud Run base images, Metabase, npm dependencies and security advisories, with a monthly "read the platform notices" step, and Dependabot configured for the root and the three services `[deps: 12.1]`
- ⬜ **[13.4]** Cloud Run adoption: the claudish-proxy service, service account, IAM and secret imported into the declarative layer per `infrastructure/cloud-run/claudish-proxy/IMPORT_PLAN.md` with `KILL_SWITCH` and the source-deploy fields in `ignore_changes`, and `event-stream`, `data-generator`, `sgtm` and `sgtm-preview` moved off the default compute service account onto dedicated runtime accounts with least-privilege roles `[deps: none]`
- ⬜ **[13.5]** Operational runbook: one entry per failure mode (sGTM not responding, event pipeline backlog, Dataform assertion failure, data generator stuck, certificate renewal failure, Claudish proxy over budget or misbehaving, a Vercel build failing on runtime deprecation, expired gcloud credentials during an incident, preview protection for automated checks), each linked to the alert that leads to it and rehearsed once, written for a reader who has never seen the stack; the Vercel automation-bypass secret is its manual task `[deps: 12.4, 13.1, 13.2, 13.4]`

---

## Phase 14 — Declarative infrastructure

_Goal: Replace the one-shot deploy scripts for GTM and the Metabase load balancer with spec-driven reconcilers, run them from a workflow with a dry-run diff on pull requests and a gated live apply, and use the GTM reconciler to wire the two events still waiting on it._

- ⬜ **[14.1]** GTM reconciler: `infrastructure/gtm/reconcile.js` diffs the committed web-container and sGTM-container specs against the live Default Workspace on each container, applies adds and updates, takes deletes only behind `--allow-deletes`, defaults to dry run, keeps `tests/integration/web-container-spec.test.ts` green, and retires `deploy-phase6.js` once it reaches parity `[deps: none]`
- ⬜ **[14.2]** Metabase load-balancer reconciler: a spec-driven reconcile of the forwarding rule, the URL map with the `/app/*`, `/api/*` and `/embed/*` split, the backend services and their IAP state, and the managed certificate, with a new `tests/integration/metabase-lb-spec.test.ts` pin, retiring `setup-domain.sh` and `setup-iap.sh` `[deps: none]`
- ⬜ **[14.3]** Reconcile workflow: `.github/workflows/infra-reconcile.yml` runs the relevant reconciler in dry-run mode on pull requests touching `infrastructure/gtm/**` or `infrastructure/metabase/**` and posts the diff as a comment, and runs the live apply on merge to `main` behind an `infra-production` environment with manual approval, authenticated through Workload Identity Federation with no service-account key in the repository `[deps: 14.1, 14.2]`
- ⬜ **[14.4]** `web_vital` and `page_engagement` wiring: custom-event triggers and GA4 event tags in the web container spec, the matching sGTM route, applied through the reconciler, so real-user Web Vitals and engagement rows land in `iampatterson_raw.events_raw` `[deps: 14.1]`

---
