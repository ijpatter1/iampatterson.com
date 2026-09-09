# Backlog

> Created 2026-09-09, when initiative 002 closed and the project moved to
> `ceremony: task`. **This file exists because task mode has no tracker.**
> `/guv:next` and `/guv:phase` both redirect to `/guv:task`, and nothing reads
> `docs/sessions/`, so anything recorded only in a handoff is effectively lost.
> The four production defects Phase 14 found were all lost exactly that way — a
> committed record with nothing reading it.
>
> One line per item, with where it came from. Delete an entry when it lands;
> don't let it rot to "probably done".

## Visitor-facing

- **The dashboards do not distinguish real traffic from the generator** — **partial progress 2026-09-09**: `08_real_vs_generated_sessions.yaml` written and pinned by `tests/unit/metabase/dashboards.test.ts`, and `06_daily_revenue_trend` now states in its description that every purchase in it is generated. **Neither is applied to Metabase**, so the live state is unchanged from the original finding: 45 cards, zero referencing `is_synthetic`. Not struck through and not moved to Closed — this file's own rule is to delete an entry when it lands, and nothing has landed. Remaining beyond applying: the other nine revenue and funnel cards (`01`–`05`, `07`) say nothing about what they are built on, and only `mart_session_events` carries `is_synthetic` — the other ten marts drop it at the mart boundary, which is the ceiling on how far this can go without a Dataform change. _(session-2026-09-09-001; the reviewer caught the strikethrough as the sediment pattern this file exists to prevent)_
- **Every purchase in the warehouse is synthetic** — 4,711 all-time, zero real, first seen 2026-07-13. So the revenue, AOV, ROAS and LTV cards are 100% generated rather than the ~99.5% a session-level ratio implies, and an `is_synthetic` breakout on them would render one populated series and one absent. A description sentence is the honest treatment there; a split is a phantom legend entry. Worth knowing before anyone "fixes" those cards with a breakout. _(measured 2026-09-09 during the review gate)_

- **GA4 enhanced-measurement events are unjoinable** — `scroll`, `user_engagement` and some SPA `page_view`s are auto-collected by the GA4 tag rather than pushed through the data layer, so they carry neither `session_id` (consumed by GA4 as a reserved name) nor `iap_session_id`, and `COALESCE` has nothing to fall back on. Measured 2026-09-09 on real non-generator rows: 742 carry `iap_session_id`, 0 carry `session_id`, **252 carry neither** (~25%). Not a regression — true since launch. Needs either a GTM-side parameter on those events or a documented decision that they stay unjoinable. The UAT bounds the residue at <0.35 so a *new* unjoinable path would surface. _(session-2026-09-09-001, found by the UAT on its first run)_
- **The BigQuery promise copy is unconditional** — a declining visitor reads "EVERY CLICK LANDS IN BIGQUERY" while their own consent rows read `[DENIED]`. **Decided 2026-09-09 (Ian): acceptable for now, revisit in a future initiative.** Recorded so the next reader knows it was seen, not missed. _(session-2026-09-09-001)_

- **A committed dashboard spec was never applied** — `07_ecommerce_funnel_drop_off.yaml` exists in `specs/questions/`, is referenced by `ecommerce_executive.yaml`, and has a test asserting the file is present. It does not exist in Metabase: the live instance has 45 cards and `.ids.json` records only 6. The tests check that spec files exist and are well-formed; **nothing checks they were applied**. Same shape as the four production defects [14.1]–[14.6] found — a committed spec drifted from the live system with nothing comparing the two. A spec-vs-live check belongs in the UAT (it needs the Metabase API key) rather than a unit test. _(found 2026-09-09 by dry-running apply.sh while adding the is_synthetic card)_

## Measurement fidelity

- **The data-layer path is now production for a class of visitors and has never carried real traffic** — the timeline fix (`db7f161`) made it the source for declining visitors. Three things on it are untested at scale: the 100-event cap, the absence of dedupe by `pipeline_id` across three concurrently-mounted `useDataLayerEvents` instances sharing one `sessionStorage` buffer (each restarting `lastIndexRef` at 0 on mount), and inferred rather than server-stamped routing. Not a known defect — a path that now has users. _(alignment review of `db7f161`)_
- **Consenting visitors cannot see fired-but-never-arrived events** — `useLiveEvents` picks one source rather than merging, so for a consenting visitor the timeline shows only what SSE confirmed. An event dropped by an ad blocker, a network failure or an sGTM rejection is silently absent, indistinguishable from one that never fired. **This is the phase-sized item**: merging needs a correlation id threaded client → GTM variable → sGTM tag → event-stream → BigQuery, because the data layer mints `dl-<ts>-<n>` locally and the server has its own `pipeline_id`, and heuristic name+session+window matching breaks on repeated `web_vital`/`scroll_depth`. Much cheaper designed in than retrofitted. _(session-2026-09-09-001)_

## Infrastructure

- **The WIF pool, provider and deployer are declared nowhere** — created by `gcloud` commands pasted into `docs/manual/task-2026-09-09-001.md` §2 and recorded in `docs/verification/2026-09-09-wif-and-ci-armed.md`. A grep for `assertion.repository` or `workloadIdentityPools` across `*.tf` and `*.sh` returns nothing, so the one string stopping any repository on earth from minting a token for a near-`roles/editor` identity has no owner. **Partly closed**: UAT scenario 11 compares the live attribute condition and the deployer's principal-set binding against the committed expectation, so drift is detected. Owed: declaring them in Terraform. _(session-2026-09-09-001, [14.3] acceptance clause)_
- **GTM publish is not gated on drift** — every merge touching `infrastructure/gtm/**` mints a container version even when the reconciler reports `no drift`; version 11 came from exactly that. Never read a high version number as evidence of change; identify a known-good version by name (`ci: <sha> on <date>`) and commit, per `docs/runbook/infra-apply-damaged-production.md`. Open decision: gate it, or leave the churn. _(session-2026-09-09-001)_

## Tooling and hygiene

- **`.claude/settings.json` grants are broader than the fix required** — `Bash(bash:*)` and `Bash(python3:*)` are committed, so any agent can route around `bash-guard`'s string matching by putting a command in a file. The `gh` side is hardened (merge, ref-write and release-create blocked, verified against a seven-case matrix). Narrowing the rest is complicated by guv invoking plugin scripts by absolute path outside the repo, which no repo-relative pattern matches. _(platform review of `cbdb824`)_
- **Six terraform grants in `.claude/settings.json` are inert** — permission patterns are literal prefixes and every terraform call here uses `terraform -chdir=…`, which does not begin with `terraform plan`. Dead config; they still prompt. _(platform review of `cbdb824`)_
- **Two of the ultra review's six confirmed findings are unrecoverable** — not present in PR #75, the session transcript, or this repo. The gap is procedural: that review's output was read in-session and never written down. A review whose findings live only in scrollback has no audit surface. _(session-2026-09-08-002)_
- **55 pre-existing TypeScript errors in test files** — unchanged across this session and excluded from `npm run build`, so nothing gates on them. Notable only against the project's "strict mode always, no `any`" standard. _(measured 2026-09-09)_
- **11 open Dependabot PRs** — including three proposing Node 26 on services pinned to Node 24 in Phase 12 ([12.1], `tests/unit/infra/runtime-currency.test.ts`). Needs a decision on the runtime floor before those merge. _(measured 2026-09-09)_

## Closed, kept briefly so they are not re-found

- ~~Scenario 3's consent check should graduate to Playwright~~ — done 2026-09-09; five of seven UAT human gates converted to real checks, two genuine judgments kept.
- ~~The declining visitor's timeline shows only the consent event~~ — fixed in `db7f161`, verified on production: 11 rows, 52 blocked and 3 sent badges.
