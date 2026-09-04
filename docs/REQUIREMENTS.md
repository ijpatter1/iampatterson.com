# iampatterson.com — Development Plan & Requirements

> **Lineage:** Phases 1–11 — greenfield build through the Claudish launch, archived at `docs/initiatives/001-greenfield-through-launch/`.
> **This initiative:** Phases 12–14 — governed by `docs/spec/operational-readiness.md`.

## Project Vision

iampatterson.com is the consulting website for Patterson Consulting and a live demonstration of a full measurement stack: Cookiebot consent, a client-side GTM data layer, self-hosted server-side GTM on Cloud Run, GA4 and BigQuery, a real-time overlay that shows visitors their own session moving through the pipeline, Dataform marts, a self-hosted Metabase, and the Claudish translator. Everything a visitor can see is built and running as of the archived initiative; the site is the portfolio.

This initiative turns that working demo into a production system one person can hand off or maintain without babysitting. It adds the monitoring, alerting, uptime checks, cost and retention controls, an operational runbook, a dependency cadence, and declarative deploys for the two infrastructure surfaces that still run on one-shot scripts. The operational layer is part of what the site demonstrates, so it is built to be read as well as run.

One constraint shapes the plan more than any other: each phase ships as one pull request that stays under the ultrareview ceiling (500 changed files, 8,000 changed lines), so the three free ultra reviews cover the three phases. The Node.js 24 runtime is the first deliverable because Vercel stops building Node 20 projects on 2026-10-01.

---

## Phase 12 — Runtime currency and observability

**Goal:** Meet the Node 24 deadline and stand up the monitoring foundation: a notification channel, uptime checks, log-based metrics, alerting policies and a dashboard, all as committed configuration applied by script.

**Deliverables:**

1. **[12.1]** Node.js 24 runtime: pin `engines.node` to `24.x`, move both stages of the three Cloud Run Dockerfiles to `node:24-slim`, record the Node 24 pin and the Homebrew arm64 toolchain note in the CLAUDE.md project facts (retiring the "Runtime deadline" fact), update the Node references in ARCHITECTURE, and confirm the sync-dataform workflow pins no Node; all suites and the proxy golden gate pass under Node 24, the Vercel production build carries no deprecation warning, and the three services are redeployed on the new image with healthy endpoints `[deps: none]`
   - *Acceptance:* root suite, three service suites and `scripts/run-claudish-golden.sh` green under Node 24 locally; the absence of the Node 20 warning confirmed in a Vercel build log (a preview build before the merge is enough; a manual task card records it); each redeploy diffs the new revision's env, scaling and service account against the prior one before traffic moves; `event-stream`, `data-generator` and `claudish-proxy` answer `/health` on new revisions; the proxy's live smoke passes in both directions.
2. **[12.2]** Notification channel and uptime checks: an email channel (Slack optional) and Cloud Monitoring uptime checks on sGTM `https://io.iampatterson.com/healthy`, event-stream `/health`, claudish-proxy `/health`, `https://www.iampatterson.com/` and the Metabase load balancer (the IAP redirect counts as healthy), every check alerting to the channel, all declared under `infrastructure/monitoring/` and applied by `apply.sh`, with one deliberate failure rehearsed and its notification recorded `[deps: none]`
   - *Acceptance:* five checks green in Cloud Monitoring; one check driven to failure on purpose produces a notification inside its window; the rehearsal is recorded in a manual task card.
3. **[12.3]** Log-based metrics and retention: metrics for the structured error events the proxy already emits (`request_error`, `loop_fell_through`, `loop_retry_failed`, `loop_empty_result`, `loop_failed_midstream`, `lane_failed`, `capacity_ladder_exhausted`) and for data-generator's `[ad-insert]` failure line, a recorded note that event-stream emits no error logs today, a provisional retention period for the `_Default` log bucket to be confirmed against the 13.1 data retention decision, a sink if anything must outlive it, and one "what failed in the last 24 hours" query each for sGTM, event-stream, data-generator and claudish-proxy for the runbook `[deps: none]`
   - *Acceptance:* metrics listed by `gcloud logging metrics list`; the provisional retention value applied and recorded in ARCHITECTURE with the 13.1 confirmation pending; the four queries run without error and each returns the injected failure from the 12.2 rehearsal.
4. **[12.4]** Alerting policies routed to the channel: Cloud Run 5xx rate per service, container restarts and crash loops, Pub/Sub oldest unacked age and undelivered count on the push subscription, Cloud Scheduler job failures, Dataform run failures, BigQuery daily spend, the claudish-proxy `budget_threshold` and `capacity_no_budget` log events, and managed certificate expiry, each with a documented threshold, any log-based metric it needs, and either a recorded test firing or a written reason it cannot be fired safely `[deps: 12.2, 12.3]`
   - *Acceptance:* every policy present with its threshold in a committed spec; a firing record or a safety note per policy; the policy specs applied by an idempotent script.
5. **[12.5]** Cloud Monitoring dashboard generated from a committed spec under `infrastructure/monitoring/` and applied by script: request rate, latency and error rate per Cloud Run service, Pub/Sub throughput and backlog, BigQuery slot usage and daily cost, scheduler outcomes, certificate status and the proxy's per-instance budget threshold crossings (`budget_threshold` at 50/80/100 %) `[deps: 12.4]`
   - *Acceptance:* the dashboard exists and can be deleted and recreated from the spec; the spec is under 300 lines because the panels are generated.

**Why this is Phase 12:** the runtime deadline is dated, and every later phase's rehearsals need a channel and alerts to land in.

**Validation:** the suites named above, the review gate (`/guv:eval`), a session handoff, and manual task cards for the rehearsals. The phase ships as one pull request under 8,000 changed lines.

---

## Phase 13 — Cost, lifecycle and the runbook

**Goal:** Put retention and cost controls in place, decide the sGTM image lifecycle, adopt the Cloud Run services into declared identity and configuration, set a dependency cadence, and write the runbook that ties every alert to a procedure.

**Deliverables:**

1. **[13.1]** Retention and cost controls: measure partition expiration on every raw and staging table, table sizes, GCS lifecycle rules and Dataform schedule state; then apply partition expiration on raw event tables, lifecycle rules on the AI export bucket, a notification channel on the existing project budget, and a Vertex spend budget for the Claudish proxy if the in-app cap is not enough on its own `[deps: 12.2]`
   - *Acceptance:* a before/after table in the deliverable's doc; every budget carries a channel; retention values recorded in ARCHITECTURE.
2. **[13.2]** sGTM container lifecycle: a recorded decision between the floating `:stable` tag and a pinned digest, and an operator script with a dry run that updates `gtm-cloud-image` on `sgtm` and `sgtm-preview`, rehearsed once end to end on `sgtm-preview` `[deps: none]`
   - *Acceptance:* the decision in ARCHITECTURE; the script's dry run and one real run on `sgtm-preview` recorded; the runbook entry written.
3. **[13.3]** Dependency update process: a documented cadence for Node, Next.js and React, Cloud Run base images, Metabase, npm dependencies and security advisories, with a monthly "read the platform notices" step, and Dependabot configured for the root and the three services `[deps: 12.1]`
   - *Acceptance:* the configuration committed and at least one update pull request produced; the cadence doc names the reviewer and the schedule.
4. **[13.4]** Cloud Run adoption: the claudish-proxy service, service account, IAM and secret imported into the declarative layer per `infrastructure/cloud-run/claudish-proxy/IMPORT_PLAN.md` with `KILL_SWITCH` and the source-deploy fields in `ignore_changes`, and `event-stream`, `data-generator`, `sgtm` and `sgtm-preview` moved off the default compute service account onto dedicated runtime accounts with least-privilege roles `[deps: none]`
   - *Acceptance:* a plan run shows no drift after import; each service's runtime account and roles listed in ARCHITECTURE; every service answers its health endpoint after the identity change.
5. **[13.5]** Operational runbook: one entry per failure mode (sGTM not responding, event pipeline backlog, Dataform assertion failure, data generator stuck, certificate renewal failure, Claudish proxy over budget or misbehaving, a Vercel build failing on runtime deprecation, expired gcloud credentials during an incident, preview protection for automated checks), each linked to the alert that leads to it and rehearsed once, written for a reader who has never seen the stack; the Vercel automation-bypass secret is its manual task `[deps: 12.4, 13.1, 13.2, 13.4]`
   - *Acceptance:* every Phase 12 alert links to an entry; one dated rehearsal per entry; the manual task card for the bypass secret exists.

**Why this is Phase 13:** the controls need the channel from Phase 12, and the runbook needs the alerts, the retention decisions and the identity changes to describe.

**Validation:** scripts and tests named per deliverable, the review gate, a session handoff, manual task cards. One pull request under 8,000 changed lines.

---

## Phase 14 — Declarative infrastructure

**Goal:** Replace the one-shot deploy scripts for GTM and the Metabase load balancer with spec-driven reconcilers, run them from a workflow with a dry-run diff on pull requests and a gated live apply, and use the GTM reconciler to wire the two events still waiting on it.

**Deliverables:**

1. **[14.1]** GTM reconciler: `infrastructure/gtm/reconcile.js` diffs the committed web-container and sGTM-container specs against the live Default Workspace on each container, applies adds and updates, takes deletes only behind `--allow-deletes`, defaults to dry run, keeps `tests/integration/web-container-spec.test.ts` green, and retires `deploy-phase6.js` once it reaches parity `[deps: none]`
   - *Acceptance:* a dry run after apply reports no drift on both containers; the integration pin green; `deploy-phase6.js` deleted with its callers updated.
2. **[14.2]** Metabase load-balancer reconciler: a spec-driven reconcile of the forwarding rule, the URL map with the `/app/*`, `/api/*` and `/embed/*` split, the backend services and their IAP state, and the managed certificate, with a new `tests/integration/metabase-lb-spec.test.ts` pin, retiring `setup-domain.sh` and `setup-iap.sh` `[deps: none]`
   - *Acceptance:* a dry run after apply reports no drift; the new pin green; the two one-shots deleted.
3. **[14.3]** Reconcile workflow: `.github/workflows/infra-reconcile.yml` runs the relevant reconciler in dry-run mode on pull requests touching `infrastructure/gtm/**` or `infrastructure/metabase/**` and posts the diff as a comment, and runs the live apply on merge to `main` behind an `infra-production` environment with manual approval, authenticated through Workload Identity Federation with no service-account key in the repository `[deps: 14.1, 14.2]`
   - *Acceptance:* one pull request shows the dry-run comment; one merge shows the approval gate and a successful apply; WIF configured and recorded in ARCHITECTURE.
4. **[14.4]** `web_vital` and `page_engagement` wiring: custom-event triggers and GA4 event tags in the web container spec, the matching sGTM route, applied through the reconciler, so real-user Web Vitals and engagement rows land in `iampatterson_raw.events_raw` `[deps: 14.1]`
   - *Acceptance:* both events queryable in BigQuery from production traffic within a day of the apply; the coverage test that pins the event roster updated.

**Why this is Phase 14:** it is the largest surface and the one with the most moving parts, so it goes last, after the alerts that would catch a bad apply exist. If its pull request approaches the ceiling, 14.4 ships as a separate small pull request without an ultra review.

**Validation:** the integration pins, the workflow's own runs, the review gate, a session handoff. One pull request under 8,000 changed lines, watched.

---

## Dependencies & Risk Notes

- **One person.** No team coordination, and no one to catch mistakes except the review gate and the tests. Tests come first on every deliverable.
- **Ownership lines.** Pushes, merges, site deploys and model choices are Ian's. The sandbox hook blocks pushes from the CLI; with explicit permission in chat a push can go through the GitHub Git Data API.
- **Secrets and data.** Secrets stay in Secret Manager or environment; nothing sensitive enters the repository, the logs or the analytics events.
- **Pull-request budget.** Each phase is one pull request under 500 changed files and 8,000 changed lines, so an ultra review can run on it. Generated configuration (dashboard panels, alert specs) is produced by scripts from compact specs rather than committed in full. Dependabot's own pull requests are separate.
- **Infrastructure discipline.** Read-only inspection first, then a dry run, then apply; every reconciler and apply script is safe to re-run; deletes are behind flags.
- **Credentials.** gcloud credentials expire hourly and overnight; the default gcloud project is not this one, so every command names the project. An expired credential mid-deliverable is a pause, not a failure.
- **Cost.** The monitoring layer costs cents per month; the retention deliverable measures before it changes anything; budgets gain channels before any new spend.
- **Deadline and its hatch.** 12.1 must merge and deploy before 2026-10-01. If the Phase 12 pull request is not ready to merge by 2026-09-24, 12.1 ships as its own small pull request without an ultra review, the same hatch 14.4 has.

## Post-initiative roadmap

Items that become possible once this initiative lands, kept out of it deliberately so the three pull requests stay reviewable:

- Mobile performance levers and SPA-navigation Web Vitals attribution, measured against the field data 14.4 delivers.
- `useEventStream` status-ref race hardening and the `window.__iapWebVitals()` console helper.
- Claudish follow-ups, each an isolated change judged on all 99 pool pairs: latch thresholds under the served detector rule, the mechanical first-person retry gate, the "lists and tables keep their shape" prompt edit, and a watch on acronym expansion.
