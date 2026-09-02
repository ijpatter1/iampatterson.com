# cl2en experiment loop: rules of engagement

**Owner:** Ian Patterson. **Written:** 2026-09-01. **Status:** approved rules; the loop
runs until the budget is spent. Read this document in full at every loop wake-up and
after every context compaction. It is the authority on what the loop may and may not do.

## 1. Ian's intent, verbatim

> I want you to run experiment arms to improve the cl2en translations. The goal is to
> produce better claudish -> english translations i.e. clear and plain english, high
> intent and meaning and communication type fidelity. Lower mean claudishness is your
> target but you will also need a measure of the axis I just described. You continue the
> loop until the $20 budget is spent. You are allowed to train new CCLD models, but you
> are not allowed to train them on en2cl or cl2en outputs. you are allowed to change the
> prompts and everything associated with the prompts. you are allowed to change the gates
> in the runCl2enLoop. Your only constraint- DO NOT GAME THE SCORE.

Clarifications from Ian, same day: two fidelity judges (Claude Haiku and Gemini 3.5
Flash-Lite); no early stop, spend the budget and report the best candidate; 0.05 is the
minimum mean drop for an arm to count as a win. The aspiration Ian named is a scoreboard
MEAN at or below 0.50 (against 0.685 at loop start), which is a 0.185 drop and is expected
to need the detector-floor arm. Ian approved the rules and said "Go" on 2026-09-01.

## 2. The two measures (fixed; do not redefine mid-loop)

**Claudishness (the scoreboard).** Mean score of the shipped detector, `r7d-mask-letme04`
(the weights in `src/lib/claudish/ccld-weights.json`), over the dev pool, plus the pass
rate (share of outputs scoring below 0.5). Cross-check: the direction of change must agree
on the majority of the 27 registry models in `~/.claudish-corpus/models/`. The loop's own
judge (`claudish-proxy/src/judge.ts`) is an instrument the loop may change; it is never
the scoreboard. The scoreboard detector is never retrained or replaced by this loop.

**Fidelity (the gate).** Two independent rubric judges, one per model family: Claude Opus 5
(via the proxy's authenticated Anthropic lane, effort low) and Gemini 3.1 Pro (global
endpoint). Chosen by the judge test of 2026-09-02 (see RESULTS.md): Haiku 4.5 and Gemini
3.5 Flash-Lite failed calibration, Sonnet 5 disagreed with Ian on all three pairs, and
Opus 5, Gemini 3.1 Pro and Gemini 3.7 Flash agreed on all three. Each scores
every input/output pair on five axes, 1 to 5: meaning preserved; speaker and stance
preserved; communication type preserved (question, request, apology, story, refusal,
report); plainness (would a busy person write this); content lost. Comparison is pairwise
against the baseline output, run twice with the order swapped, so position bias cancels.
Calibration before the first arm: both judges must agree with Ian's recorded judgments on
the meme, email and loud-marketing pairs; then the rubric is frozen. FROZEN 2026-09-02:
rubric v2 (the survival test stated in the rubric; dropped register clauses are not loss),
pairwise mode only. Cost rule: arms are judged on a fixed 30-input subset of the dev pool
(`cl2en-judged-subset.json`: 6 battery, 4 golden, 8 round-trip, 12 holdout, seed 20260902),
about $0.52 per arm for both judges; the full 99 are judged only for final candidates. Mechanical guards
remain hard floors: first person survives when the input has it, a question stays a
question, identifiers and numbers survive, no output under 0.25 of input length without a
recorded reason, no wrapper tags echoed.

**A win** is: mean scoreboard drop of at least 0.05 on the dev pool, registry direction
agreeing, both fidelity judges at or above baseline, guards at or above baseline, then
confirmed on the held-out set.

## 3. Sets (fixed)

- Dev pool: the 99 Claudish inputs in `~/.claudish-corpus/analysis/2026-09-01-model-compare/cl2en-pool.json`
  (30 round-trip transcript originals, 13 golden, 6 battery, 50 training-holdout positives).
- Held-out set: about 50 fresh positives from `~/.claudish-corpus/models/holdout.jsonl`,
  sampled once with a fixed seed, disjoint from the dev pool, written next to it as
  `cl2en-heldout.json`. No arm is tuned on it; only final candidates are scored on it.
- Baseline: the deployed configuration at loop start (prompt v10, Gemini 3.5 Flash-Lite,
  epsilon 0.015, tiers 6/7/8/8), report `pool-35lite-eps015-x3.json`.
- Neither set is edited, filtered, or re-sampled during the loop. Raw transcript text never
  enters the repository.

## 4. What the loop may change

Prompts and everything associated with them (system text, few-shots, feedback text, the
wrapping of the user turn). The gates, schedule, temperatures, plateau rule, feedback
builder and evidence functions in `runCl2enLoop` and `judge.ts`. New detector models for
use as loop-judge components, trained only on human-written and corpus text. Deterministic
output layers (the em-dash smoother, a marker strip, a facts check).

## 5. What the loop may not do (the anti-gaming rules)

1. Never train a detector on en2cl or cl2en outputs, or on any text produced by a model in
   this system.
2. Never change the scoreboard detector, the sets, or the rubric after calibration.
3. Never accept an arm whose scoreboard gain comes with a fidelity or guard regression:
   shorter, emptier, or less faithful output is not a win however it scores.
4. Never tune against the held-out set.
5. Never deploy. Candidates are presented to Ian with pairs for his read.
6. Before each arm runs, a small independent subagent receives section 1 of this document
   and the arm's description, and answers: "Does this action deviate from Ian's stated
   intent in service of gaming the score?" A yes stops the arm; the answer is recorded
   either way in the results log.

## 6. Mechanics

One arm per loop iteration, self-paced with the loop skill. Per arm: describe it in the
results log; run the intent check; build the variant; translate the dev pool through the
real loop (`cl2en-local.ts`, model and location from env, system text from
`CL2EN_SYSTEM_FILE` when the prompt is the variable); score the registry
(`score-registry.ts`); run the guards (`fidelity-guards.py`); run both fidelity judges;
append the spend to the ledger; write the arm's row to the results table; persist the
report, scores and pairs under `~/.claudish-corpus/analysis/2026-09-01-model-compare/`;
schedule the next arm. The harness scripts live in that analysis folder and in the session
scratchpad; step 0 of the loop copies them into `scripts/claudish/cl2en-lab/` with paths
parameterised so a future session can run them.

Budget: the $20 cap includes everything spent since the overnight delegation. Ledger:
`spend-ledger.jsonl` in the analysis folder (the session scratchpad was wiped once on
2026-09-01 and the ledger was reconstructed from its last printed total, $8.08; nothing
lives in the scratchpad any more). Each arm
costs roughly $0.15 to $0.20 to translate and $0.20 to $0.30 to judge.

## 7. Results log

`~/.claudish-corpus/analysis/2026-09-01-model-compare/RESULTS.md`, one row per arm:
arm id, description, intent-check verdict, scoreboard mean and pass rate, registry
direction, Haiku and Gemini fidelity preference (win/tie/loss counts), guard deltas,
compression, cost, verdict (win / no change / rejected and why). The best candidate so far
is named at the top.

## 8. Planned arms (order may change with evidence; each is a hypothesis)

1. Minimal prompt as the new base (807 chars; tied the deployed prompt on the scoreboard
   at a third of the tokens, and was the first variant to keep the speaker's act on the
   meme case).
2. Marker strip and a facts-preservation retry gate, in code.
3. The residual kill-word rule added back to the minimal prompt (soft-reply residue).
4. Principle-based retry feedback (the survival test) instead of symptom lists.
5. Retry gate widened for drafts convicted on structure alone (26 of 99 close the gate).
6. Temperature schedule and best-of-two first drafts.
7. Detector floor: a new model trained with more human plain-technical and business
   negatives, evaluated as a loop-judge component.
8. Combinations of winners.

## 9. Stopping and reporting

The loop stops when the ledger reaches $20.00 (no early stop). Final step: score the best
candidates on the held-out set, write the results table and the pairs for Ian's read, and
record a Decision entry in the session handoff. Ian decides what ships.
