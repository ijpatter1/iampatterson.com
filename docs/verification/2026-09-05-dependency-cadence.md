# Dependency update process

Deliverable 13.3. The configuration, the cadence document, and one acceptance
clause that cannot be checked from a branch.

## What landed

`.github/dependabot.yml` — nine update entries:

| Ecosystem | Directories |
| --- | --- |
| npm | root, `claudish-proxy`, `event-stream`, `data-generator`, `dataform` |
| docker | the three Cloud Run service directories |
| github-actions | root |

Monthly, first Monday, grouped, with low pull-request limits. The reasoning is in
the config's own header and is worth repeating: this is a solo project, and a bot
that opens fifteen pull requests a week gets bulk-merged rather than reviewed,
which is worse than no bot. Security advisories bypass the schedule, because
GitHub raises those as security updates regardless and they are meant to
interrupt.

Base-image bumps are deliberately never grouped. A base image is a runtime
change, and the Node 20 deadline is the worked example of what one costs.

`docs/runbook/dependency-cadence.md` — the reviewer (Ian), the schedule (first
Monday), a monthly "read the platform notices" step, a row per surface with what
an update actually costs, and an advisory triage order.

## Five npm surfaces, not four

The deliverable names "the root and the three services". There are five
`package.json` files that are not build artifacts: `infrastructure/dataform`
is a fourth service-shaped surface that ships nothing but would still rot
unwatched. It is included, and a test asserts every watched directory actually
has a manifest.

## Two surfaces no bot can watch

Dependabot does not see an image tag consumed by a Cloud Run service, so both
pinned images are hand-checked on the monthly pass:

- **`gtm-cloud-image`** — worse than unwatched, because the tag looks like it
  auto-updates and does not (13.2). `update-image.sh status` is the check.
- **Metabase** — baseline v0.59.6, confirmed live on 2026-09-05. Updates go
  through `infrastructure/metabase/upgrade.sh`, which already refuses to proceed
  until the operator confirms they read the release notes. That gate predates
  this deliverable and is kept rather than replaced.

A test asserts there are exactly two such rows, so a future edit that quietly
drops one fails rather than passing as tidying.

## The baseline, and the thing it found

Measured 2026-09-05: **25 outdated packages** at the root, and **32 advisories —
14 high, 16 moderate, 2 low, 0 critical**.

Two are direct, and both have a semver-compatible fix available:

| Package | Advisory | Category |
| --- | --- | --- |
| `next` | denial of service via Server Components, affects `<= 16.3.0-preview.10`; the site runs `^16.2.4` | **1 — direct and reachable in production** |
| `postcss` | XSS via unescaped `</style>` in the CSS stringifier, `<= 8.5.22` | 2 — direct, build-time |

The remaining twelve are transitive and arrive mostly through Lighthouse and
Puppeteer, which are dev-only.

**Not fixed here, deliberately.** A framework bump on a production site earns its
own reviewed change with a build check; folding it into a deliverable about
process would make both harder to review. The cadence document names the `next`
advisory as its first scheduled action and says it should not wait for the first
Monday. That is a recommendation to a person, not a task left silently undone.

## The acceptance clause that is not met

13.3's acceptance asks that the configuration be "committed and at least one
update pull request produced". **The second half cannot be checked from this
branch.** Dependabot reads its configuration from the repository's default
branch, so it will not open anything until this work merges to `main`.

This is recorded rather than quietly counted as done. The clause becomes
checkable within a day of merge; the check is that pull requests labelled
`dependencies` appear. Whether the acceptance should have said "committed, and
verified after merge" is a wording question for `/guv:replan` and is drafted in
the session handoff for ratification, since the phase is still open and that is
exactly the correction the 12.3 erratum asks future deliverables to make in time.

## Checks

| Check | Result |
| --- | --- |
| `.github/dependabot.yml` parses, 9 entries | yes |
| Every watched npm directory has a `package.json` | asserted by test |
| Every watched docker directory has a `Dockerfile` | asserted by test |
| 12 pins | pass |
| Suite | 1,912 → 1,924 across 177 suites |
| At least one Dependabot pull request | **not yet — requires merge to `main`** |
