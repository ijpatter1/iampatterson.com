# Dependency update cadence

> Deliverable 13.3. The machinery is `.github/dependabot.yml`; this page is the
> part a bot cannot hold — who looks, how often, and what each surface's update
> actually costs.

**Reviewer:** Ian Patterson. Solo project, so the reviewer and the merger are the
same person and there is no second pair of eyes. That is the reason the cadence
below is monthly and grouped rather than weekly and granular: a bot that opens
fifteen pull requests a week gets bulk-merged, and a bulk-merged dependency
update is worse than no bot at all.

**Schedule:** the first Monday of each month, Dependabot opens the grouped pull
requests below. Security advisories ignore that schedule by design — GitHub
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
3. **Run `npm audit`** at the root and in each service. Advisories that Dependabot
   has not already raised are the ones with no fix available yet; note them and
   move on rather than force-fixing.
4. **Check the two pinned images** that no bot watches: `gtm-cloud-image` and
   Metabase. Both are below.

## Per surface

| Surface | Watched by | Cadence | What an update costs |
| --- | --- | --- | --- |
| Node runtime | Dependabot (docker) + the notices step | Monthly, and whenever a deprecation date is announced | Real. It touches `engines.node`, three Dockerfiles, the Vercel project setting and three redeploys. Phase 12 deliverable 12.1 is the worked example. |
| Next.js and React | Dependabot (npm, grouped `next-react`) | Monthly | Moderate to high. They move together — a pull request that bumps one without the other cannot pass. A major is its own deliverable, as Phase 10a was for 14→16 and React 18→19. |
| npm dependencies, site | Dependabot (npm, grouped) | Monthly | Low, usually. The suite is the gate. |
| npm dependencies, services | Dependabot (npm, per service) | Monthly | Low, but each service has its own suite and its own deploy; a merged bump is not live until the service is redeployed. |
| Cloud Run base images | Dependabot (docker, ungrouped) | Monthly | A base image bump is a runtime change, which is why these are never grouped with anything. Redeploy through `scripts/deploy-cloud-run.sh`. |
| GitHub Actions | Dependabot (github-actions) | Monthly | Low. |
| `gtm-cloud-image` (sGTM) | **Nobody. Check it by hand.** | Monthly, step 4 | See `docs/runbook/sgtm-image-update.md`. Dependabot does not watch a tag consumed by a Cloud Run service, and this one is worse than unwatched: the tag looks like it auto-updates and does not. Run `bash infrastructure/sgtm/update-image.sh status`. |
| Metabase | **Nobody. Check it by hand.** | Monthly, step 4 | Baseline **v0.59.6**, which is what is live. Updates go through `infrastructure/metabase/upgrade.sh`, which already refuses to proceed until you confirm you have read the release notes. Keep that gate; Metabase minors have migrated the app database before. |
| Security advisories | GitHub security updates | Whenever they land | Judged case by case against the table below. |

## Advisories are not all the same

`npm audit` counts a vulnerability in a Lighthouse-only dev dependency the same
as one in the framework serving the site. They are not the same, and the cadence
should not pretend otherwise. Triage in this order:

1. **Direct, and reachable in production.** Fix now, out of cadence.
2. **Direct, dev-only.** Fix on the monthly pass.
3. **Transitive, dev-only.** Fix when the parent updates. Forcing a resolution
   here usually breaks the tool and fixes nothing real.

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
- The remaining twelve are transitive and mostly arrive through Lighthouse and
  Puppeteer (`@puppeteer/browsers`, `extract-zip`, `basic-ftp`, `ip-address`),
  which are dev-only.

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
