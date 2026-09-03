# Claudish translator: current state

One page that says what is served, what is being measured, and what is only a flag. Update it whenever any of these change; the session record and the loop reports hold the history, this holds the present.

Last updated: 2026-09-02 (Decision #39).

## Definition

Claudish is the register, not the author (Ian, 2026-09-02, Decision #38). The register has two sides: vocabulary and rhetoric (contrastive negation, dash hinges, validation openers, significance closers, the meme words) and reply shape (the announcing opener, the balanced clause with a verdict, the consequence tacked on the end, the confident aside). A plain Claude reply is English; a person writing in the register is Claudish.

## Served detector (input box)

- **Rule F:** confidence = mean of two models, then the larger of that and the regex heuristic (`src/lib/claudish/detect.ts`).
  - `src/lib/claudish/ccld-weights.json` = **r28-register-self2-v6**, the loop-3 register model (vocabulary and rhetoric), featurizer v6.
  - `src/lib/claudish/ccld-weights-shape.json` = **r7d-mask-letme04**, the original authorship model, which reads reply shape.
- **Latch:** enter 0.80, exit 0.55, minimum 24 characters, 250 ms dwell. Tuned for the authorship model and never re-read since. Below 0.30 the label is confident English.
- **Measured (2026-09-02):** held-out Claude pastes 62% detected + 26% leaning; translations roundtrip clean 85%; humans writing about Claude topics read English 69%, MDN pages 96%.
- Model card: `docs/claudish/ccld-model-card.md` (generated; describes the primary file).

## Served translator loop (proxy)

- Revision `claudish-proxy-00023-98z`. Loop judge = the same two members vendored in `src/vendor/judge-weights.ts` (`JUDGE_WEIGHTS` r28, `REFERENCE_WEIGHTS` r7d), combined by the median (of two: the mean), heuristic max on top. Pass under 0.5.
- Prompt version **v10** (`src/prompts/cl2en.system.ts` + 10 few-shots, about 6,100 characters). Retry feedback style **principle** (`buildNegationFeedback`). Retry gates: mechanical evidence, structural evidence (0.6 and two convicting sentences), plateau 0.015, length-scaled attempt cap and deadline (`loopBudgetFor`).
- Origin allowlist accepts one wildcard host entry; defaults include production, `https://iampatterson-com-*.vercel.app`, and `http://localhost:3000`.
- Golden suite: `scripts/run-claudish-golden.sh` (33 cases, live, about $0.03) is the operator gate before and after a deploy. Under rule F at lock-in: Tests:       33 passed, 33 total.

## Experimental, opt-in, not served

| flag / seam | where | status |
|---|---|---|
| `feedbackStyle: 'axis'` + axis gate | proxy loop, `LOOP_FEEDBACK=axis` in the lab | names which detector still convicts and the shapes per sentence; validation run pending (round 4) |
| Minimal prompt v3 (2,114 chars, states the output language) | `~/.claudish-corpus/analysis/2026-09-01-model-compare/cl2en-system-minimal-v3.txt`, lab `CL2EN_SYSTEM_FILE` + `CL2EN_SYSTEM_FULL=1` | single-input transcripts only; validation run pending |
| `sentenceJudge`, `sentenceRetry`, `parallelRetries`, `paragraphParallel` | proxy loop options; lab `LOOP_SENTENCE_JUDGE`, `LOOP_SENTENCE_RETRY`, `LOOP_PARALLEL`, `LOOP_PARAGRAPHS` | measured once on 7 inputs: no config sentence-clean under r7d (it convicts plain sentences), sentence-only retries cut tokens 25%, paragraph parallelism keeps wall time flat at 3.5x tokens; splice defects known |
| `setJudgeRule('max')` | proxy judge, lab `LOOP_JUDGE_RULE=max` | lab instrument only |
| `setJudgeModels` | proxy judge, lab `LOOP_JUDGE_MODELS=tag,...` | swaps ensemble members from the registry |
| `GEMINI_DEBUG_LOG`, `CL2EN_TRANSCRIPT` | proxy gemini client, lab runner | raw request/frame log and per-attempt transcripts; never set in production |
| `POS_LABELS` and friends, `--turn-final-only`, featurizers v5/v7 | trainer, miner, featurizer | loop-3 machinery; r28 came from it |

## Assets outside the repo

`~/.claudish-corpus/`: transcript chunks (`chunks.jsonl`, `chunks-turnfinal.jsonl`, `claudeai-chunks.jsonl`), negatives with manifests, the model registry (`models/`, 44 tags), register labels (`labels/`, 26,989 judge-scored chunks), and the analysis folder with every loop's ledger, results and logs. Never committed.

## Open decisions

1. Latch thresholds under rule F (the operating curve is in the loop-3 report).
2. Whether the reply shape should count at sentence level, and with what instrument (r7d convicts plain sentences; r28 reads nothing at sentence level).
3. Whether to promote prompt v3 + axis feedback: the round-4 validation run answers it.
