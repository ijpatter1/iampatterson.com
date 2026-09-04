# Phase Status Tracker

> **Current Phase: 12 — Runtime currency and observability**
> Last updated: 2026-09-04, session-2026-09-04-001

---

## Phase 12 — Runtime currency and observability

_Goal: Meet the Node 24 deadline and stand up the monitoring foundation: a notification channel, uptime checks, log-based metrics, alerting policies and a dashboard, all as committed configuration applied by script._

- ⬜ **[12.1]** Node.js 24 runtime: pin `engines.node` to `24.x`, move the three Cloud Run Dockerfiles to `node:24-slim`, update the Node references in the project rules and ARCHITECTURE, check the sync-dataform workflow; all suites and the proxy golden gate pass under Node 24, the Vercel production build carries no deprecation warning, and the three services are redeployed on the new image with healthy endpoints `[deps: none]`
- ⬜ **[12.2]** Notification channel and uptime checks: an email channel (Slack optional) and Cloud Monitoring uptime checks on sGTM `/healthy`, event-stream `/health`, claudish-proxy `/health`, `https://www.iampatterson.com/` and the Metabase load balancer (the IAP redirect counts as healthy), with one deliberate failure rehearsed and its notification recorded `[deps: none]`
- ⬜ **[12.3]** Log-based metrics and retention: metrics for the structured error events the services already emit (the proxy's `request_error`, `loop_fell_through`, `loop_retry_failed` and `loop_empty_result`; event-stream and data-generator errors), a decided retention period for the `_Default` log bucket, a sink if anything must outlive it, and one "what failed in the last 24 hours" query per service for the runbook `[deps: none]`
- ⬜ **[12.4]** Alerting policies routed to the channel: Cloud Run 5xx rate per service, container restarts, Pub/Sub oldest unacked age and undelivered count, Cloud Scheduler job failures, Dataform run failures, BigQuery daily spend, the claudish-proxy budget and capacity log events, and managed certificate expiry, each with a documented threshold and either a recorded test firing or a written reason it cannot be fired safely `[deps: 12.2, 12.3]`
- ⬜ **[12.5]** Cloud Monitoring dashboard generated from a committed spec under `infrastructure/monitoring/` and applied by script: request rate, latency and error rate per Cloud Run service, Pub/Sub throughput and backlog, BigQuery slot usage and daily cost, scheduler outcomes, certificate status and the proxy budget percentage `[deps: 12.4]`

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
