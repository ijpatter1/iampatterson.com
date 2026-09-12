# Dependency update cadence

> Deliverable 13.3. The machinery is `.github/dependabot.yml`; this page is the
> part a bot cannot hold — who looks, how often, and what each surface's update
> actually costs.

**Reviewer:** Ian Patterson. Solo project, so the reviewer and the merger are the
same person and there is no second pair of eyes. That is the reason the cadence
below is monthly and grouped rather than weekly and granular: a bot that opens
fifteen pull requests a week gets bulk-merged, and a bulk-merged dependency
update is worse than no bot at all.

**Schedule:** the **first of each month**, Dependabot opens the grouped pull
requests below. (Not "the first Monday" — `schedule.day` only applies to weekly
intervals, so a monthly schedule runs on the first day of the month whatever
day that is. The config carried a `day:` key that did nothing, and this line
described a cadence the machinery never implemented.) Security advisories ignore that schedule by design — GitHub
raises those as security updates whenever they land, and they are meant to
interrupt.

## The monthly pass

1. **Read the platform notices.** Fifteen minutes, before touching any pull
   request. Vercel's changelog, Cloud Run release notes, and the Node release
   schedule. This step exists because of a specific failure: Vercel deprecated
   Node 20 builds with a hard date of 2026-10-01, and that date arrived through a
   dashboard notice, not through a dependency bump. No bot would have raised it.
   The question this step answers is "has a platform I depend on announced an end
   date for something I am using?"
2. **Work the Dependabot pull requests**, grouped as configured.
3. **Run `npm audit`** at the root, in each service, and in `infrastructure/dataform`. Advisories that Dependabot
   has not already raised are the ones with no fix available yet; note them and
   move on rather than force-fixing.
4. **Check the two pinned images** that no bot watches: `gtm-cloud-image` and
   Metabase. Both are below.
5. **Check the blocked list** below. Each row names what an update is waiting on
   and the command that answers whether it still is.
6. **Run `npm outdated`** at the root, in each service, and in `infrastructure/dataform`. This is the only step
   that sees an update `open-pull-requests-limit` suppressed: past the cap
   Dependabot opens no pull request at all, so nothing else in this pass would
   show it.

## Blocked

An update that cannot be taken yet stays open and red. It is never `ignore`d in
`.github/dependabot.yml` — nothing in that file suppresses an update by name,
deliberately. A block you can see is a decision; a block configured away is a
surprise a year later with nothing left to raise it. The cost of that choice is
this table: a red pull request nobody records becomes wallpaper, so step 5 reads it.

Two kinds of row live here. Most are updates that **cannot be taken yet**. A few
are updates that **were** taken by forcing a resolution — an `overrides` pin — and
are filed for the opposite reason: so the pin carries a recorded exit and does not
outlive its cause. Triage item 4 below is what mandates the second kind.

`open-pull-requests-limit` is the other way an update can vanish, and it is not
solved by the table. Past the cap Dependabot opens nothing at all — no pull
request, no red. The service caps are set from their group arithmetic; **the root
cap of 3 is already binding** and step 6 is what catches what it swallowed.

| Update | Blocked by | Release condition | Last checked |
| --- | --- | --- | --- |
| `typescript` → 6.x — root, event-stream, data-generator | `ts-jest` 29.4.6 is what those three have installed, and it declares `>=4.3 <6`. This half is **our** lag, not upstream's: 29.4.12 is published and widens to `<7`. claudish-proxy is already on 29.4.12 and is not blocked at 6. | Bump `ts-jest` to 29.4.12 — the pending group pull requests already do it. The block then moves to the row below. | 2026-09-10 |
| `typescript` → 7.x — all four npm surfaces | `ts-jest@29.4.12` declares `>=4.3 <7`, and that is the newest published release, so this half is upstream lag. At **root only**, a second and independent cap: eight `@typescript-eslint/*` packages declaring `>=4.8.4 <6.1.0`, which arrive transitively through `eslint-config-next` — the repo declares no direct dependency on them. No service carries eslint at all. | `npm view ts-jest@latest peerDependencies.typescript` widening past 7. For root that is necessary but not sufficient: the `@typescript-eslint` cap lifts only when `eslint-config-next` pulls a newer parser, so check `npm ls @typescript-eslint/parser` at root rather than the standalone package — `npm view typescript-eslint@latest` would report a release this repo has not received. | 2026-09-10 |
| `qs` → 6.16.0 without an override — all three services | **`express` is the blocker, on all three.** 4.22.2 is the newest express 4 and declares `qs: ~6.15.1`; 4.22.1 declares `~6.14.0`. Neither admits 6.16.0, so no express 4 release reaches the fix. claudish-proxy was the proof: already on 4.22.2 with qs 6.15.3 and still carrying both advisories. `body-parser` was a co-blocker and is no longer one — 1.20.8 declares `~6.16.0`, and this change ships it in event-stream and data-generator; claudish-proxy still has 1.20.6 at `~6.15.1`. **All eight qs alerts are runtime-scope**, from three advisories (GHSA-4mjr-xmp4-gh2g, GHSA-x5fp-wj9c-mxmx, GHSA-q8mj-m7cp-5q26), and express installs its query parser into the default router stack — so qs parses every request whether or not the app reads `req.query`. claudish-proxy is world-invokable, so waiting on express was not the call. **Taken as an `overrides` pin of `qs` to 6.16.0 in all three service manifests.** | An express 4.22.3 whose `qs` range admits 6.16.0, or express 5 adoption. Then delete the three `overrides` blocks: an override that outlives its cause is a silent pin on a package the parent has already moved past. Check with `npm view express@4 dependencies.qs`. | 2026-09-11 |
| `extract-zip` — root, dev-only via `lighthouse` | **No fixed version exists.** Both advisories (GHSA-7pqw-9j4j-h8q3, GHSA-jmr9-qjv8-65gv) cap at `<= 2.0.1`, and 2.0.1 is the newest release ever published. It arrives through `lighthouse@12.8.2 → puppeteer-core@24 → @puppeteer/browsers@2.13.0`. The fix is upstream of the vulnerable package rather than in it: `@puppeteer/browsers@3.x` dropped `extract-zip` altogether — its dependencies are now `yargs` and `modern-tar`. | `lighthouse` 13, which declares `puppeteer-core ^25.3.0`. It is a dev-only major that **nothing in CI exercises** — `scripts/capture-cwv-baseline.sh` is run by hand from `docs/uat/phase-10b-uat.sh` — so adopting it means re-capturing the Core Web Vitals baseline and confirming the report shape that script reads (`categories.performance.score`, `audits['largest-contentful-paint'].numericValue`) survives the major. That is a task, not a bump. | 2026-09-11 |
| `node` → 26 — the three service Dockerfiles | Nothing upstream. `engines.node` is `24.x` and `tests/unit/infra/runtime-currency.test.ts` asserts every Docker stage is `node:24-slim`, so the bump is red on arrival by design — and green-looking in CI, because nothing in the root suite rebuilds the images. Node 26 is Current, not LTS. | Node 26 reaches LTS **2026-10-28**; Node 24 is supported to 2028-04-30 and enters maintenance 2026-10-20. After the LTS date, take it as one migration: three Dockerfiles, `engines.node`, the currency test, and a check of Vercel's supported runtimes. Closed three times so far (#63, #64, #65). | 2026-09-12 |

The two `typescript` rows and the `node` row are not security exposures:
`typescript` is a devDependency and compiles away, and the Node bump is a currency
move with an LTS date rather than an advisory. **The other two are.** `extract-zip`
is two high-severity advisories with no fix in existence, and `qs` was three
runtime advisories, pinned around rather than waited out. A blocked **runtime** or
**framework** row is the case that matters, because those carry external end dates
— which is what step 1 exists
to catch.

`ts-jest` is the removable half of this block. Node 24 strips types natively and
this project runs Node 24 on every surface, so dropping ts-jest would take one of
the two constraints off permanently and close a second incident already recorded
against it in `docs/BACKLOG.md`. That is its own task, not a line in this table.

**A 0.x minor is a major.** Semver level is what `.github/dependabot.yml` uses to
decide whether an update travels in a group, and it misreads pre-1.0 packages: a
`0.122 → 0.123` bump is semver-*minor* and rides in the grouped pull request.
`claudish-proxy` depends on `@anthropic-ai/sdk` and `@anthropic-ai/vertex-sdk`,
both 0.x and both the riskiest runtime dependencies in the repo. Their gate is not
the grouped suite — it is `scripts/run-claudish-golden.sh`, run before and after.
`f1a889e` is the worked example of a vertex-sdk change that only that gate would
have caught.

## Per surface

| Surface | Watched by | Cadence | What an update costs |
| --- | --- | --- | --- |
| Node runtime | Dependabot (docker) + the notices step | Monthly, and whenever a deprecation date is announced | Real. It touches `engines.node`, three Dockerfiles, the Vercel project setting and three redeploys. Phase 12 deliverable 12.1 is the worked example. |
| Next.js and React | Dependabot (npm, grouped `next-react`) | Monthly | Moderate to high. They move together — a pull request that bumps one without the other cannot pass. A major is its own deliverable, as Phase 10a was for 14→16 and React 18→19. |
| npm dependencies, site | Dependabot (npm, grouped for minors and patches; majors arrive one per pull request) | Monthly | Low, usually. The suite is the gate. A major is judged on its own — see Blocked above when one cannot be taken. |
| npm dependencies, services | Dependabot (npm, per service; grouped for minors and patches, majors individually) | Monthly | Low, but each service has its own suite and its own deploy; a merged bump is not live until the service is redeployed. |
| Cloud Run base images | Dependabot (docker, ungrouped) | Monthly | A base image bump is a runtime change, which is why these are never grouped with anything. Redeploy through `scripts/deploy-cloud-run.sh`. |
| GitHub Actions | Dependabot (github-actions) | Monthly | Low. |
| Dataform (`@dataform/core`) | Dependabot (npm, grouped `all`) | Monthly | Judged by the `dataform compile` job in `test.yml`, which also asserts the compiled object counts — `compile` alone exits 0 whenever the graph resolves. **What green proves is that the project compiles and the model set is unchanged; nothing here executes SQL against BigQuery**, so a bump that still compiles but changes what the marts contain is not covered. `@dataform/cli` is deliberately not a dependency: this `package.json` is mirrored to the `dataform` branch GCP compiles from, so CI derives the CLI version from the pinned core version instead. |
| `gtm-cloud-image` (sGTM) | **Nobody. Check it by hand.** | Monthly, step 4 | See `docs/runbook/sgtm-image-update.md`. Dependabot does not watch a tag consumed by a Cloud Run service, and this one is worse than unwatched: the tag looks like it auto-updates and does not. Run `bash infrastructure/sgtm/update-image.sh status`. |
| Metabase | **Nobody. Check it by hand.** | Monthly, step 4 | Baseline **v0.59.31**, which is what is live (upgraded from v0.59.6 on 2026-09-11 for CVE-2026-72898). Updates go through `infrastructure/metabase/upgrade.sh`, which already refuses to proceed until you confirm you have read the release notes. Keep that gate; Metabase minors have migrated the app database before. |
| Security advisories | GitHub security updates | Whenever they land | Judged case by case against the table below. |

## Advisories are not all the same

`npm audit` counts a vulnerability in a Lighthouse-only dev dependency the same
as one in the framework serving the site. They are not the same, and the cadence
should not pretend otherwise. Triage in this order:

1. **Direct, and reachable in production.** Fix now, out of cadence.
2. **Direct, dev-only.** Fix on the monthly pass.
3. **Transitive, dev-only.** Fix when the parent updates. Forcing a resolution
   here usually breaks the tool and fixes nothing real.
4. **Transitive, runtime-reachable, and the parent's range cannot admit the fix.**
   This is the one case where forcing a resolution is right, and rule 3 does not
   cover it — the parent updating will never help, because the parent's own
   declared range is what excludes the fixed version. Pin it in `overrides`, prove
   it with the service suite, and put a row in the table above carrying the
   condition for **removing** the pin. An override with no recorded exit is how a
   dependency quietly stops tracking upstream. `qs` is the worked example.

## Baseline, measured 2026-09-05

The state this cadence starts from, so the first pass has something to compare
against.

- **25 outdated packages** at the root.
- **32 advisories: 14 high, 16 moderate, 2 low, 0 critical.**
- **Two are direct**, and both have a semver-compatible fix available:
  - `next` — denial of service via Server Components, affecting everything up to
    `16.3.0-preview.10`. The site runs `^16.2.4`. **Category 1**: direct and
    reachable in production.
  - `postcss` — XSS via an unescaped `</style>` in the CSS stringifier,
    `<=8.5.22`. Build-time, so category 2.
- The remaining **twelve of the fourteen high-severity** advisories are
  transitive, arriving mostly through Lighthouse and Puppeteer
  (`@puppeteer/browsers`, `extract-zip`, `basic-ftp`, `ip-address`), which are
  dev-only. The eighteen moderate and low advisories are not itemised here;
  they are worked on the monthly pass.

**The first scheduled action for this cadence is the `next` advisory.** It was
found while writing this page and deliberately not fixed here: a framework bump
on a production site earns its own reviewed change with a build check, not a
line in a deliverable about process. It is category 1 and should not wait for the
first Monday.

## What this cadence does not cover

Terraform provider versions, which are pinned in
`infrastructure/terraform/versions.tf` and moved deliberately when the layer is
worked on, and the Claudish model ID, which is Ian's decision and is documented
with the proxy.
