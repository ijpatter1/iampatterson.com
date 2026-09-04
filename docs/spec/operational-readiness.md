# Operational readiness and maintenance infrastructure

> **Provenance.** Source: the Phase 11 section and post-launch roadmap of `docs/REQUIREMENTS.md` as of `main` 4814d92, the live infrastructure sweep of 2026-09-03 (this session), and the Claudish launch record (Decision #43, 2026-09-04). Ingested 2026-09-04. This file is the immutable source the generated phase docs derive from; amend the plan through `/guv:replan`, not by editing this file.

## Goal

Turn a working demo into a production system one person can hand off or maintain without babysitting: monitoring, alerting, uptime checks, cost and retention controls, a runbook, a dependency cadence, and declarative deploys for the two infrastructure surfaces that still run on one-shot scripts. The site is a portfolio; the operational layer is part of what it demonstrates.

## Hard deadline

Vercel has deprecated Node 20 builds. Deployments created on or after **2026-10-01** fail unless `package.json` pins `engines.node` to `24.x`. The Vercel project setting is already 24.x; the repo is not. This is the first deliverable and the only one with a date.

## Current state (measured 2026-09-03)

What exists today in project `iampatterson`, region `us-central1`:

- **Cloud Run services:** `sgtm` and `sgtm-preview` on `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` (floating tag, min 1 / max 3), `event-stream` (min 1 / max 1), `data-generator` (max 10, scale to zero), `metabase` (`metabase/metabase:v0.59.6`, internal-and-load-balancer ingress, IAP on the main backend, IAP off on the `/embed` backend by design), `claudish-proxy` (min 1 / max 4, its own runtime service account, revision 00029). `event-stream`, `data-generator`, `sgtm` and `sgtm-preview` run as the default compute service account (a carry-forward from the Phase 10d security review).
- **Health endpoints:** `/health` on event-stream, data-generator and claudish-proxy; sGTM serves `/healthy`; the site is on Vercel behind `www.iampatterson.com`; Metabase is at `bi.iampatterson.com` behind IAP.
- **Scheduling:** three Cloud Scheduler jobs run the data generator on weekdays (`:00`, `:20`, `:40` past the hour, 09–17). Their last attempts succeeded.
- **Pub/Sub:** one topic, one push subscription to event-stream, 30 s ack deadline, seven-day retention, no dead-letter topic.
- **Monitoring:** zero alert policies, zero notification channels, zero uptime checks, zero dashboards, zero log-based metrics. Cloud Logging keeps the `_Default` bucket at 30 days and `_Required` at 400.
- **Budgets:** `metabase-project-budget` ($200/month, thresholds 50/90/100 %) exists on this project with no notification channels attached. The Claudish proxy enforces its own $23/day cap in code, with a kill switch.
- **Certificates:** the managed certificate for `bi.iampatterson.com` is active and renews itself.
- **Dataform, BigQuery retention and GCS lifecycle** were not reached by the sweep (credentials expired); their state is unknown and is the first thing the retention deliverable measures.
- **Runtimes and images:** `package.json` engines `20.x`; the three service Dockerfiles use `node:20-slim`; no Dependabot configuration; one GitHub Action (`sync-dataform`).
- **Vercel:** deployment protection is on for previews with no automation bypass secret, so automated checks cannot read a preview without a browser login. Environment variables are complete after the launch fixes.

## Deliverables

Each item lists its acceptance. Sizing is the plan's job; where an item is plainly more than one session, it says so.

### 1. Node.js 24 runtime

Pin `engines.node` to `24.x` in `package.json`; move the three Cloud Run Dockerfiles from `node:20-slim` to `node:24-slim`; update the Node references in `.claude/rules/` and `docs/ARCHITECTURE.md`; check the `sync-dataform` workflow for a pinned Node; record the local toolchain note (Homebrew arm64 Node) where the rules already describe it.

Acceptance: the root suite, the three service suites and the proxy golden gate pass under Node 24 locally; a Vercel production build completes without the deprecation warning; the three services are redeployed on the new image and their health endpoints answer; the proxy's live smoke in both directions passes.

### 2. Uptime checks and notification channels

Uptime checks for sGTM `/healthy`, event-stream `/health`, claudish-proxy `/health`, the site (`https://www.iampatterson.com/`) and the Metabase load balancer (accepting the IAP redirect as healthy). At least one notification channel (email; Slack optional) attached to every check.

Acceptance: five checks visible in Cloud Monitoring, each green; a deliberate failure on one service (scale to zero or a wrong path) produces a notification within the check's window; the manual task records the received alert.

### 3. Alerting policies

Policies for: Cloud Run 5xx rate per service, container restarts and crash loops, Pub/Sub oldest unacked message age and undelivered count on the push subscription, Cloud Scheduler job failures, Dataform run failures, BigQuery daily spend, the claudish-proxy `budget_threshold` and `capacity_no_budget` log events, and managed certificate expiry. All routed to the channel from deliverable 2.

Acceptance: each policy exists with a documented threshold and a test that fired it once (or a written reason it cannot be fired safely), and the runbook links each alert to its procedure.

### 4. Cloud Monitoring dashboard

One dashboard: request rate, latency and error rate per Cloud Run service; Pub/Sub throughput and backlog; BigQuery slot usage and daily cost; scheduler outcomes; certificate status; the claudish-proxy budget percentage.

Acceptance: the dashboard exists as a committed JSON definition under `infrastructure/monitoring/` and is applied by a script, not hand-built, so it can be recreated.

### 5. Log aggregation and retention

Log-based metrics for the error patterns the services already emit as structured events (the proxy's `request_error`, `loop_fell_through`, `loop_retry_failed`, `loop_empty_result`; event-stream and data-generator error events). A decided retention period for the `_Default` bucket, aligned with the data retention decision in deliverable 6, and a sink if anything must outlive it.

Acceptance: metrics listed in `gcloud logging metrics list`; the retention setting applied and recorded; a query in the runbook that answers "what failed in the last 24 hours" for each service.

### 6. Data retention and cost controls

Measure first: partition expiration on every raw and staging table, table sizes, GCS bucket lifecycle rules, Dataform schedule state. Then apply: partition expiration on raw event tables, lifecycle rules on the AI export bucket, a notification channel on the existing project budget, and a second budget for the Claudish proxy's Vertex spend if the in-app cap is not enough on its own.

Acceptance: a before/after table in the deliverable's doc; every budget has a channel; retention values recorded in `docs/ARCHITECTURE.md`.

### 7. sGTM container lifecycle

Decide between the floating `:stable` tag and a pinned image digest, document the update procedure for `gtm-cloud-image` releases (including `sgtm-preview`), and write it as an operator script with a dry run.

Acceptance: the decision recorded, the script exercised once end to end on `sgtm-preview`, and the runbook entry written.

### 8. Operational runbook

Procedures for: sGTM not responding, event pipeline backlog, Dataform assertion failures, data generator stuck or failing, certificate renewal failure, Claudish proxy over budget or misbehaving (kill switch, revert to a previous revision, the golden gate), a Vercel build failing on runtime deprecation, expired gcloud credentials during an incident, and the preview protection bypass for automated checks. Each entry names the alert that leads to it. Doubles as portfolio content, so it is written for a reader who has never seen the stack.

Acceptance: every alert from deliverable 3 links to an entry; one rehearsal per entry recorded with its date.

### 9. Dependency update process

A documented cadence for Node, Next.js and React, Cloud Run base images, Metabase (currently v0.59.6), npm dependencies and security advisories, with Dependabot or an equivalent configured for the root and the three services. Includes the Node 24 lesson: runtime deprecations arrive with a date, so the cadence has a monthly "read the platform notices" step.

Acceptance: the configuration is committed and produced at least one update PR; the cadence doc names who reviews and when.

### 10. Declarative infrastructure reconcilers

Two reconcilers driven by committed specs, replacing the one-shot scripts: (a) GTM, diffing `infrastructure/gtm/web-container.json` and the sGTM equivalent against the live workspaces and applying adds and updates, deletes only behind a flag; (b) the Metabase load balancer topology (forwarding rule, URL map with the `/app/*`, `/api/*`, `/embed/*` split, backend services, IAP state, managed certificate). A GitHub Actions workflow runs the reconcilers in dry-run mode on pull requests touching `infrastructure/gtm/**` or `infrastructure/metabase/**` and posts the diff; live apply on merge behind a manual-approval environment, authenticated with Workload Identity Federation. Adopt the Claudish proxy into the same declarative layer using `infrastructure/cloud-run/claudish-proxy/IMPORT_PLAN.md`, and move `event-stream`, `data-generator` and `sgtm` off the default compute service account.

This is more than one session. The plan should split it: the GTM reconciler and its integration pin; the Metabase reconciler and its pin; the workflow and WIF; the Claudish and service-account adoption.

Acceptance: each reconciler's dry run reports no drift against the live resource after apply; the existing integration tests (`tests/integration/web-container-spec.test.ts`, a new `metabase-lb-spec.test.ts`) stay green; `deploy-phase6.js`, `setup-domain.sh` and `setup-iap.sh` are retired once parity is reached.

### 11. Carry-forwards that unblock once the above exists

Route these into the plan after their dependency, do not fold them into it:

- `web_vital` and `page_engagement` sGTM triggers and GA4 event tags (after the GTM reconciler); then the mobile performance levers and the SPA-navigation attribution for Web Vitals, which need that field data.
- `useEventStream` status-ref race hardening and the `window.__iapWebVitals()` console helper (small, any time).
- Claudish: the latch thresholds under the served detector rule, the mechanical first-person retry gate, the "lists and tables keep their shape" prompt edit, and a watch on acronym expansion. Each is one isolated change judged on all 99 pool pairs, never on the 30-input subset.

## Constraints

- Solo developer. No team coordination, no one to catch mistakes except the review gate and the tests. Every deliverable carries its tests first.
- Pushes, merges, deploys of the site, and model choices are Ian's decisions; the sandbox hook blocks pushes from the CLI.
- Secrets stay in Secret Manager or environment; nothing sensitive enters the repo or the logs.
- Pull requests stay under 8,000 changed lines so the three free ultra reviews can cover the most consequential ones.
- Infrastructure changes are read-only inspections first, then a dry run, then apply; the reconcilers must be safe to re-run.
- Costs stay inside the existing budgets; the monitoring layer itself should cost cents per month.

## Validation

Per phase: the tests and scripts named in each acceptance line, the review gate (`/guv:eval`), a session handoff, and a manual task card for anything that needs a browser or a console.
