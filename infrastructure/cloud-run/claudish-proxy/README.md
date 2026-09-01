# claudish-proxy

Streaming translation proxy for the Claudish translator
(iampatterson.com/claudish): SSE pass-through in front of Claude Haiku on
Vertex AI, with a capacity ladder, per-IP rate limiting, and a hard daily
spend cap. Latency is the product — time to first token is the metric
everything here serves.

## Shape

- `POST /translate` `{ text ≤1200 chars, direction: en2cl|cl2en }` →
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

```
gcloud run services update claudish-proxy --project=iampatterson \
  --region=us-central1 --update-env-vars KILL_SWITCH=on
```

~30s to roll. The page shows the verbatim capacity line; cache hits
still serve. Revert with `KILL_SWITCH=off`.
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
X-Forwarded-For to confirm the `TRUSTED_PROXY_HOPS=2` index; check
`cache_read_input_tokens` on a repeat call — EXPECT 0 today: the interim
few-shot block sits below Haiku 4.5's 4,096-token cache minimum, and
caching engages only once the lexicon-generated set grows the system
block past it (tracked in prompts/index.ts); send FORCE_REFUSAL_TOKEN's
value (set it on a staging revision only) to smoke the refusal path;
rehearse the kill switch.
