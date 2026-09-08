# A Vercel build failing on runtime deprecation

**No alert leads here.** Vercel does not notify this project's monitoring, and a
failed build does not take the site down — the previous deployment keeps serving.
You find out when a change you expected to be live is not.

This entry exists because of a specific near-miss, and the general lesson matters
more than the specific fix.

## The specific case

Vercel deprecated Node 20 builds. Deployments created on or after **2026-10-01**
fail unless `package.json` pins `engines.node` to `24.x`. The project moved to
Node 24 across every surface in September 2026, so this particular deadline is
met — `tests/unit/infra/runtime-currency.test.ts` fails if any surface slips
back.

## The general shape

A platform announces an end date for something you depend on, and the
announcement arrives in a dashboard notice or a changelog. **No dependency bot
raises it**, because nothing in your dependency tree changed. The first
mechanical signal is a build that fails on the date, by which point you are fixing
it under time pressure.

That is why `docs/runbook/dependency-cadence.md` opens its monthly pass with
fifteen minutes of reading platform notices before touching any pull request. The
question that step answers is: has a platform I depend on announced an end date
for something I am using?

## Diagnose

Read the build log in the Vercel dashboard. A runtime deprecation says so
explicitly, naming the version and the date.

Then check what the repository actually declares, because the Vercel project
setting and `package.json` are separate and can disagree:

```bash
python3 -c "import json;print(json.load(open('package.json'))['engines'])"
grep -rn 'node:' infrastructure/cloud-run/*/Dockerfile
```

The Vercel project's own Node setting lives in its dashboard, and it was already
on 24.x while the repository was still on 20 — that mismatch is exactly what the
deprecation notice was about.

## Fix

Pin the runtime and redeploy. For the record, the Node 24 move touched five
places, and missing any one of them leaves a half-migrated project:

1. `engines.node` in `package.json`
2. both stages of each of the three Cloud Run Dockerfiles
3. the Vercel project setting
4. the Node references in `docs/ARCHITECTURE.md` and `.claude/rules/`
5. the local toolchain note, because this machine needs a specific Node on PATH

Then redeploy the three Cloud Run services through
`scripts/deploy-cloud-run.sh`, and let Vercel rebuild the site.

## How you know it worked

A production build completes with no deprecation warning. The build log will say
it skipped the build cache because the Node version changed — that line is the
confirmation the new runtime is actually in use, not just configured.

```bash
npm test && npm run build
```

locally, under the same Node version, before pushing anything.

## Rehearsal

Not rehearsed as a staged failure. The deadline was met rather than missed, and
staging it would mean deliberately pinning an unsupported runtime and pushing a
deployment to production to watch it fail. The migration itself is the evidence:
it was performed on 2026-09-04 and recorded in
`docs/verification/2026-09-04-node24-runtime.md`, including the build log line
showing the cache skipped for the version change.
