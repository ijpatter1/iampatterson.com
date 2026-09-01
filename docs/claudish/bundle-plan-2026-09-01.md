# Claudish bundle plan — 3,000-character cap + savings

**Created:** 2026-09-01, feat/claudish
**Status:** Stage 1 shipped 2026-09-01 as rev-00016 (Decision #30); Stage 2 shipped 2026-09-01 as rev-00017 on Ian's side-by-side read (Decision #31) — caching verified live (5,112-token prefix read from cache), golden 33/33; the Stage 2 range gate below is retired in favour of the principle gate described in Decision #31; prompt v10 shipped as rev-00018 (Decision #32); Stage 3 not started
**Scope:** one branch-sized unit of work in three gated stages. Nothing here touches the loop mechanics, the judge, or the tuned prompt content except where a stage says so explicitly.

## What the bundle contains

| Item | Source | Kind |
|---|---|---|
| Input cap 1,200 → 3,000 chars, with its four coupled changes | Ian, LinkedIn testing | product change |
| Budget tracker priced at real Gemini rates | savings analysis S4 | correctness / capacity |
| Budget reservation re-derived for 3,000-char worst case | cap change | correctness |
| en2cl prefix grown past the 4,096-token caching minimum via range few-shots | savings analysis S1 + range work | tuning + savings |
| Cloud Run memory 512Mi → 256Mi, canaried | savings analysis S3 | infra |
| Explicit Gemini context caching, max-instances, output caps, Vertex migration | savings analysis S2/S5 | explicitly skipped, recorded |

## Stage 1 — the cap, and the money math that depends on it

One coordinated commit. The cap is not a single constant: six places must move together or long posts truncate, share links break, or the budget under-reserves.

1. `src/lib/claudish/limits.ts` — `INPUT_CAP` 1200 → 3000. The textarea `maxLength`, the counter ("/ 3,000"), and the share-codec source gate all derive from it. Raise the share-codec target gate (currently 8,192) to 12,000 so a fully expanded Claudish output still encodes; long posts will still degrade to the bare-link tier under `SHARE_URL_MAX` — expected, already handled.
2. Proxy validation threshold (`config.ts`) mirrors 3,000. `express.json` at 16kb already covers it.
3. Output caps (`MAX_TOKENS`): en2cl 1024 → 3072 (a 3,000-char post expands to ~2,600 tokens; 1024 truncates at ~4,000 chars), cl2en 512 → 1536. The Gemini loop's 2048 is already sufficient.
4. Budget reservation (`RESERVATION_USD`): worst case at 3,000 chars is en2cl ≈ (2.2k + 0.75k) input × $1/MTok + 2.6k output × $5/MTok ≈ $0.016; reserve $0.018. Today's reservation is sized for 1,200 and would under-reserve ~5×.
5. Budget tracker repricing (S4, done here because it shares the reservation code): per-lane prices — Gemini at $0.30 / $2.50, Haiku at $1 / $5 — replacing the deliberate Haiku-rate overestimate on the loop. Effect: ~1.5× real capacity inside the same $23/day cap, no behavior change.
6. Loop budget tier: > 2,000 chars → 5 attempts / 40s (`loopBudgetFor`). Each attempt on a 3,000-char input runs 6–10s; the current top tier's 25s allows only two. Consequence for the concealed UX: the "Translating…" spinner can run 30–40s on the longest posts.

**Tests (red first):** cap constants pinned in sync across client and proxy; an arithmetic pin that en2cl's worst-case expansion at `INPUT_CAP` fits inside `MAX_TOKENS.en2cl`; share-codec long-input degrade test; reservation ≥ derived worst case; two new golden cases at ~2,500 chars (one per direction) asserting `stop_reason` is `end_turn`, not `max_tokens`.

**Gate:** root suite, service suite, golden (33 cases), the two-way battery, deploy, then manual QA: paste a 2,900-char LinkedIn post both directions and round-trip it.

**Cost note for the record:** per-call worst case rises from ~$0.0035 to ~$0.016 on en2cl (output tokens dominate at length; input is ~$0.0008). Typical 1,800-char posts land near $0.008. The daily cap trips earlier under a long-post viral day, which is the cap doing its job.

## Stage 2 — range few-shots that also switch caching on

The verified finding from the cost analysis: padding the en2cl prefix past 4,096 tokens activates Anthropic prompt caching (~80% off the dominant input line at sustained traffic, ~$6.8/day saved at 10k translations/day), but at trickle traffic every isolated call becomes a fresh cache write and costs roughly double. In dollars, that downside is capped at about $0.20/day at 100 translations/day; the upside scales with traffic. Because `cache_control` is already set on the system block, caching activates automatically the moment the prefix crosses the minimum — no flag, no traffic-conditional prompt (which would make translation quality vary with traffic, and is ruled out).

So the decision is framed as a tuning decision that happens to switch caching on: the padding must be **device-variety few-shots that earn their place by widening range** — the work you asked for after the "testament" critique — written as abstractions, not user-supplied examples.

1. Author ~2,300 tokens of additional en2cl few-shots across the repertoire's device families (opener moves, hedged precision, bold labels, rule-of-three, varied significance verbs), each register word appearing at most once across the whole set.
2. Target prefix ≥ 4,500 tokens measured with the billed count (the API's `input_tokens`), not a chars/3.8 estimate — the analysis found a ~5% drift between the two, and 4,300 would leave no margin.
3. Verify on a two-call burst that `cacheReadTokens` > 0 in telemetry.

**Gate:** golden (en2cl assertions unchanged), the range battery — distinct register words ≥ 13 and no word used more than 3 times across the 8 outputs (the post-v6 baseline) — and a spot read for humor. Deploy.

## Stage 3 — memory canary

After Stages 1 and 2, because a larger cap slightly raises per-request buffer size and a larger prefix raises nothing on the proxy (prompts are strings).

1. `setup.sh`: memory as an env with default 256Mi; deploy.
2. Run the two-way battery once for a functional check, then watch Cloud Run's memory-utilization metric for 24 hours; acceptance is p99 utilization under 70%.
3. Rollback is the env flip back to 512Mi. Saving: ~$1.6/month gross.

## Explicitly not in the bundle

Gemini explicit context caching (storage fees exceed savings at low traffic; implicit caching is free and activates under load), max-instances changes (they do not bill), output-token caps as a cost lever (unused `max_tokens` does not bill), and moving en2cl to Vertex when the quota lands (same $1/$5 and the same caching minimum — redundancy value only).

## Sequencing summary

Stage 1 (cap + repricing + reservation) → Stage 2 (range few-shots / caching) → Stage 3 (memory canary). Each stage is its own commit with its own gate; a failed gate stops the bundle at that stage rather than rolling the earlier ones back. Estimated effort: Stage 1 about half a day including QA; Stage 2 two to three hours plus evaluation; Stage 3 fifteen minutes plus the 24-hour watch. Handoff entry and `docs/PHASE_STATUS.md` update at the end; the feat/claudish push and PR remain Ian's.
