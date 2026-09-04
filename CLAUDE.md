# iampatterson.com

> The consulting website for Patterson Consulting, built as a live demonstration of a full measurement stack (Cookiebot → GTM → self-hosted sGTM → GA4 and BigQuery, with a real-time overlay over the visitor's own session), plus the Claudish translator at `/claudish`. The site is the portfolio.

This file is deliberately short. It holds only what Claude **can't infer from the
code or the manifest**. Everything else is imported or referenced below — if a
fact lives somewhere more specific, it lives there, not here.

## How this project is wired

- **Behavior & conventions:** `.claude/rules/guv-*.md` — the engineering rules that govern how you work, loaded natively every session. Always in effect. Add project-specific rules as unprefixed files alongside; sync replaces `guv-*` only.
- **Memory authority:** the manifest and the latest session handoff are authoritative; treat auto memory as hints and never let it override either.
- **Commands, stack, roots, ceremony, guards:** `.claude/project.json` — the single source of truth for _facts_. Read the test/build/lint/format/dev commands from there and run them; **never hardcode a command in this file or assume one**. A `null` command means the project has no such step — skip it, don't substitute a default.
- **Process commands:** `/task` (scoped change), `/onboard` (adopt an existing repo), `/init` (greenfield setup), `/plan` (multi-phase initiative on an existing project), then `/phase` (phase-boundary entry), `/next` (light daily/mid-phase resume), `/replan` (plan mutation — the one sanctioned door), `/eval`, `/handoff`, `/status`, `/manual`. The commands carry the repeatable procedure; follow their steps. (Installed as the guv plugin, every name carries the namespace: `/guv:task`, `/guv:handoff`, ….)
- **Sometimes-relevant workflows & domain knowledge:** skills, loaded on demand so they don't cost context every session — in project `.claude/skills/` (template install) or shipped inside the guv plugin.
- **Execution at scale:** the planning layer is the phase docs and the commands; the execution layer is the model, subagents, and — for wide mechanical fan-out — workflows you save in project `.claude/workflows/` (none ship with guv since [32.3]). Workflow QA gates use the platform review plus the `reviewer` by name, and ultracode is fan-out-only, dropped back after (`.claude/rules/guv-workflows.md`).
- **Enforcement:** the isolation tier (native sandbox by default; Docker sandbox + firewall opt-in) is the spatial boundary, and the hooks (`bash-guard`, `auto-format`, `stop-check`) are the semantic layer within it. `settings.json` permissions are a convenience layer, not a security layer — the isolation tier is the hard line.

## Where the code lives

Read `roots` from `.claude/project.json`:

- **Control plane** (your working directory): `roots.control`. Docs, session artifacts, and `.claude/` config live here.
- **Code**: `roots.code` — may be a _sibling repo_. All git operations against the product (`git -C roots.code log/diff/status`) target the code root; doc and session commits target the control root.
- **Single-repo projects** set both roots to `"."`, so the two collapse into one tree and nothing special happens.

**Naming convention (split topology):** the code repo keeps the plain product name; the control plane is its sibling named per the `<project>-guv` convention (here `<product>-guv`) — a possessive suffix (the product's guv), human-facing only: no script ever discovers a control plane by name; the manifest's `roots` is the sole machine pointer. The manifest's `name` stays the _product_ name (it feeds image/container labels), not the directory name.

```
~/dev/
├── <product>/        # code repo (roots.code: "../<product>")
└── <product>-guv/    # control plane — Claude launches here (cwd, roots.control: ".")
```

Single-repo projects don't name a control plane at all — the product repo is the only repo.

## Ceremony — how much process applies

Read `ceremony` from the manifest:

- **`task`** — scoped work. No phase docs. Understand → TDD the change → evaluate → done.
- **`onboard`** — an existing repo whose conventions you _infer and follow_, never scaffold over.
- **`phased`** — greenfield with the full plan. The plan and live state are in `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/PHASE_STATUS.md`, and the latest `docs/sessions/` handoff. Work the resolver's frontier (`bash .claude/resolve-ready.sh`) — dispatch is deps-only, and a later-phase item in `ready=` is legitimate; phases remain the unit of narrative, review, and UAT.

A missing project-shape artifact is a _mode signal_, not an error: no phase docs means task/onboard mode, not a broken setup.

## Project facts Claude can't infer

- **Node on this Mac.** The project runs on Node 24 (`engines.node` 24.x). Prepend `/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin` to `PATH` in every shell command: the keg-only arm64 Node 24 first, then the arm64 Homebrew tools; an x64 Node or the arm64 Node 20 elsewhere on the machine breaks the project.
- **gcloud defaults to the wrong project.** The CLI's default project is `holdout-500412`; every GCP command passes `--project=iampatterson --region=us-central1`. Credentials expire roughly hourly and overnight; Ian re-authenticates with `! gcloud auth login`.
- **Deployed topology.** Vercel hosts the Next.js site (production redirects the apex to `https://www.iampatterson.com`, so `www` is the browser origin). Cloud Run in `iampatterson` runs `sgtm` (custom domain `io.iampatterson.com`), `sgtm-preview`, `event-stream`, `data-generator`, `metabase` (behind an IAP load balancer at `bi.iampatterson.com`) and `claudish-proxy`. Three Cloud Scheduler jobs drive the data generator on weekdays.
- **Claudish proxy contract.** `NEXT_PUBLIC_CLAUDISH_PROXY_URL` is the full endpoint (`https://…run.app/translate`); the client also completes a bare service URL. Deploy code changes with `scripts/deploy-cloud-run.sh deploy claudish-proxy infrastructure/cloud-run/claudish-proxy` then `promote <revision>` (the same script serves event-stream and data-generator); use `MODEL_ID_CONFIRMED=1 bash setup.sh` from the service directory for env or IAM changes; the kill switch is `--update-env-vars KILL_SWITCH=on` and survives deploys. The golden suite (`scripts/run-claudish-golden.sh`) is the operator gate before and after a deploy.
- **Never in the repo.** Transcript corpus and model registry live in `~/.claudish-corpus/`; secrets come from Secret Manager or env only; `.env*` files are not read by Claude; no input or output text in logs or analytics events.
- **Pushes and merges are Ian's.** The `bash-guard` hook blocks pushes and destructive gcloud commands regardless of chat permission. With explicit permission in chat, a push can go through the GitHub Git Data API (used once, 2026-09-04).
- **Model choices are Ian's.** Propose candidates with live pricing and verified IDs, then wait.
- **Dataform branch is generated.** `dataform` mirrors `infrastructure/dataform/` and is synced from `main` by a GitHub Action; edit models under `infrastructure/dataform/` only.
- **Event schema changes follow the checklist** in `.claude/rules/project-coding-standards.md` (schema pin, narrative-flow cases, BigQuery `schema.json` columns, GTM container wiring).
- **Review gate is `/guv:eval`**, not the legacy `@evaluator` pair. Ultrareview (`/code-review ultra`) has three free runs per account, one-time; keep PRs under 8,000 changed lines to qualify.
- **Runtime currency.** Vercel fails Node 20 builds from 2026-10-01; the project moved to Node 24 on every surface (engines pin, `node:24-slim` images, Vercel project setting) in Phase 12, deliverable 12.1. `tests/unit/infra/runtime-currency.test.ts` pins it.

## What is intentionally NOT in this file

So future edits don't drift it back toward bloat:

- **Commands** → `.claude/project.json`. Never restated here.
- **Behavior, TDD discipline, commit conventions, "write clean code"** → `.claude/rules/`. Standard conventions Claude already knows are omitted entirely.
- **Directory-by-directory tours, API docs, tutorials** → the code is the source; link to real docs if needed.
