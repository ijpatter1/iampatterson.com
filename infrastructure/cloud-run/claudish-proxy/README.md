# claudish-proxy

Streaming translation proxy for the Claudish translator
(iampatterson.com/claudish): SSE pass-through in front of Claude Haiku on
Vertex AI, with a capacity ladder, per-IP rate limiting, and a hard daily
spend cap. Latency is the product — time to first token is the metric
everything here serves.

## Shape

- `POST /translate` `{ text ≤3000 chars, direction: en2cl|cl2en }` →
  `text/event-stream` of `data: {"type": ...}` frames:
  `meta`, `token`*, then exactly one of `done | refusal | capacity | error`.
- Pre-stream failures are HTTP: 400/403/405/413/429 (+Retry-After)/503.
- `GET /health` — budget percentage, capped flag, lane roster. No upstream calls.

## The capacity ladder

`LANES` env, in order: `vertex-global` (ADC, primary — cheaper than
regional and lowest-latency) → `vertex-regional` (us-east5) →
`anthropic-api` (funded fallback via Workload Identity Federation —
the runtime SA's metadata-server identity token exchanged for a
short-lived Anthropic access token; no key exists) → `cache-only`.
Failover happens only BEFORE the first token (the commit barrier);
refusals never fail over — that's a policy decision this toy does not make.

**Since 2026-11-15 the service runs `LANES=anthropic-api,cache-only`.**
The project's Claude quota on Vertex is zero (`vertex-global` answers 429)
and `vertex-regional` answers 404, so every request paid two failed calls
first: en2cl p95 time to first token was 2,844 ms with them and 1,295 ms
without. The Vertex lane code stays. Pass the full ladder in `LANES` to
turn it back on once quota exists.

## Cost controls, honestly

Per-IP limits (20/min, 200/hr, 1000/day, per instance) shape the happy
path; ten coordinated IPs can still exhaust the daily cap. The REAL
backstop is the budget tracker: worst-case reservation per request,
reconciled to actual usage, capped at `DAILY_BUDGET_USD / MAX_INSTANCES`
per instance, tripping to cache-only until UTC midnight. Numbers:
the user-decided backstop is $25/day TOTAL; `DAILY_BUDGET_USD=23` is
the model-spend slice, leaving ~$2 for the Cloud Run floor plus
headroom — the two figures are deliberate, not drift. max-instances=4
is blast radius, not cost control.

## Kill switch (runbook)

From the repo root:

```
bash scripts/deploy-cloud-run.sh kill-switch claudish-proxy on
```

It builds a revision on the serving image with `KILL_SWITCH=on` and no
traffic, checks that nothing else changed, moves all traffic to that exact
revision, and confirms the serving revision carries `KILL_SWITCH=on`. The
page shows the verbatim capacity line; cache hits still serve. Turn it off
with `kill-switch claudish-proxy off`, and remember that you must, because
nothing will do it for you.

Why not `gcloud run services update --update-env-vars KILL_SWITCH=on`:
`deploy-cloud-run.sh promote` pins traffic to a named revision, so that
command makes a revision that serves 0% and spending carries on (found
2026-11-15). The same applies to any env change: use
`deploy-cloud-run.sh set-env claudish-proxy KEY=VALUE --promote`.

Deploys keep the switch as it is: `setup.sh` merges its env with
`--update-env-vars` and never writes `KILL_SWITCH`, and `deploy-cloud-run.sh
deploy` never writes env. **A rollback does not:** env lives on each
revision, so `promote <older revision>` restores that revision's
`KILL_SWITCH` and `LANES`. After a rollback mid-incident, run the kill
switch again.

**Terraform note:** once D9 imports this service, `KILL_SWITCH` must be
in `ignore_changes` or the next `terraform apply` silently reverts an
emergency flip (documented in IMPORT_PLAN.md).

## Security posture

`--allow-unauthenticated` is the deliberate exposure — a public toy.
Compensating controls: server-side input cap, origin gate (403 without
an allowlisted Origin — CORS protects browsers, not curl), per-IP
limits, spend cap + kill switch, and a redaction contract (input/output
text, `stop_details.explanation`, and raw SDK error messages never reach
logs — test-enforced). Runs as `claudish-proxy@` with `aiplatform.user`
only, NOT the default compute SA.

## Privacy

No input bodies logged, anywhere: allowed log fields are an explicit
allowlist (src/log.ts); `ipHash` is salted per-instance and
non-reversible. The same rule extends to the frontend's analytics.

## Testing

- `npm test` — 80 unit/integration tests, zero network, zero spend
  (FakeLane + real listening socket).
- `GOLDEN_TEST=1` / `LATENCY_TEST=1` — live-API suites, gated exactly
  like the repo's LOAD_TEST precedent. Run via
  `scripts/run-claudish-golden.sh` / `scripts/run-claudish-latency.sh`
  (repo root). Baselines go to `docs/perf/`. No CI runs these today
  (no workflow runs Jest; WIF pending from Phase 11 D9) — they are a
  pre-deploy operator gate.

## Deploy

`bash setup.sh --dry-run`, then `MODEL_ID_CONFIRMED=1 bash setup.sh`
(the gate: verify the pinned model ID first via
`docs/manual/task-2026-08-31-001.sh --probe`). Prerequisites (Model
Garden enablement, quota check, Anthropic key) are the manual task at
`docs/manual/task-2026-08-31-001.md`.

Deploy smoke checklist (T16): chunk timestamps prove SSE is unbuffered
end-to-end; CORS from the Vercel origin; capture a real request's
X-Forwarded-For to confirm the `TRUSTED_PROXY_HOPS` index (default 1 on
the direct run.app deployment: Google's front end appends the client IP as
the last entry; set 2 only behind an external load balancer; confirmed
2026-09-03 through the rate limiter, review batch 1); check
`cache_read_input_tokens` on a repeat call — EXPECT it above 0: the en2cl
system block has sat past the cache minimum since bundle Stage 2, and
Claude Haiku 5.5's minimum is 512 tokens (Haiku 4.5's was 4,096; see
prompts/index.ts); send FORCE_REFUSAL_TOKEN's
value (set it on a staging revision only) to smoke the refusal path;
rehearse the kill switch.
