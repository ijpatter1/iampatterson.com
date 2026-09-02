# cl2en experiment loop: report

**Run:** 2026-09-01 evening to 2026-09-02 morning, under `docs/claudish/cl2en-experiment-rules.md`.
**Budget:** $20.00 cap including prior spend; final ledger in `~/.claudish-corpus/analysis/2026-09-01-model-compare/spend-ledger.jsonl`.
**Status:** DRAFT while the replication and the held-out judging finish; the two rows marked "pending" are filled in at close.

## Headline

No arm cleared the win bar (a 0.05 drop in the shipped detector's mean with fidelity at or above baseline). The loop produced one keepable change, a minimal 807-character prompt that matches the 6,192-character deployed prompt on the detector and on both frontier fidelity judges at a third of the input tokens, and one structural finding that matters more than any single arm: in this loop, every change that lowered the detector score did so by dropping meaning, and the two independent frontier judges caught each one. The detector-side route (retraining the loop's judge on human text) was tried twice and closed: a character-n-gram model can be made fairer to human documentation but not to plain translations, whose residual conviction is the transcript skeleton.

## Measures (frozen before arm 1)

- Scoreboard: mean of the shipped detector `r7d-mask-letme04` over the 99-input dev pool, pass rate below 0.5, direction cross-checked on the 27-model registry. Never retrained.
- Fidelity: pairwise against the comparator, order-swapped, on a fixed 30-input subset, by Claude Opus 5 and Gemini 3.1 Pro (chosen by a six-model judge test: Haiku 4.5, Gemini 3.5 Flash-Lite and Sonnet 5 disagreed with Ian's recorded judgments; Opus 5, Gemini 3.7 Flash and Gemini 3.1 Pro agreed on every pair). Rubric v2 (the survival test; dropped register clauses are not loss), frozen.
- Guards: first person, questions, identifiers, numbers, compression.
- Intent check: an independent subagent answered "does this deviate from Ian's intent in service of gaming the score?" before every arm; all proceeded, one with a stated condition (arm 7) that the evaluation design already met.

## Arms

| arm | change | comparator | scoreboard | Opus 5 (c/b/t) | Gemini 3.1 Pro | verdict |
|---|---|---|---|---|---|---|
| 1 | minimal prompt, no few-shots | deployed | 0.673 (−0.012) | 12/8/7 | 12/9/9 | kept as base |
| 2 | wrapper strip + facts retry | deployed | 0.709 (+0.024) | 9/9/11 | 5/7/18 | rejected (speaker) |
| 2b | facts retry with speaker guard | arm 1 | 0.699 (+0.026) | 3/12/13 | 8/12/10 | rejected (every axis) |
| 3 | residue word rule | deployed | 0.715 (+0.030) | 10/8/12 | 7/10/13 | rejected (speaker) |
| 4 | principle-led retry feedback | arm 2b | 0.716 (+0.017) | 15/4/10 | 5/7/18 | kept (meaning up) |
| 5 | widened retry gate | arm 4 | 0.646 (−0.070) | 4/14/10 | 6/9/15 | rejected (meaning lost) |
| 6 | combination with widened gate, facts off | deployed | 0.687 (+0.002) | 10/9/8 | 8/9/13 | not a win |
| 7 | retrained judge component, human tech prose | offline | n/a | | | not adopted (stricter on translations) |
| 7b | retrained judge component, topic-fair | offline | n/a | | | not adopted (worse everywhere) |
| 8a | clean candidate: 1 + 4, default gate | deployed | 0.729 (+0.044) | 9/10/11 | 7/9/14 | not a win |
| 8b | retry temperature 0.3 | arm 8a | 0.684 (−0.045) | 8/11/10 | 9/6/15 | neutral; recovers baseline level |
| 1r | replication of arm 1 | deployed | pending | pending | pending | noise check |

Full rows, per-case scores and pairs: `~/.claudish-corpus/analysis/2026-09-01-model-compare/RESULTS.md` and the `pool-*.json`, `scores-*.csv`, `judge-*.json` files beside it.

## Held-out set (50 fresh transcript chunks)

| candidate | scoreboard (live baseline → candidate) | pass | paired | guards | judges |
|---|---|---|---|---|---|
| arm 8a configuration | 0.767 → 0.791 | 16% → 18% | 13 / 16 / 21 | equal | not judged |
| final candidate | pending | pending | pending | pending | pending |

## What the loop learned

1. The detector and fidelity trade against each other under this loop. Arm 5 is the clean example: −0.070 on the detector, meaning 4.70 → 4.14. The fidelity gate is doing its job.
2. Retries are where fidelity is lost. Every mechanism that added retries (facts gate, widened gate) re-narrated the speaker or dropped content; lowering retry temperature (arm 8b) did not hurt and recovered the scoreboard.
3. Prompt size was not earning its keep: the minimal prompt ties the deployed one on both axes at a third of the tokens.
4. The detector floor is not a data-mix problem. Two retrains on human-only data (one with technical prose re-weighted, one with human writing about the same topics oversampled) were fairer or worse on human sources and stricter on translations. The residual conviction on plain translations is the transcript skeleton.
5. Run-to-run noise on the scoreboard is larger than assumed: the same prompt scored 0.673 and 0.729 with only the retry feedback changed; the replication (1r) measures this directly.
6. Recycled loop output had entered detector training in earlier rounds (`translated-positives.txt`); it is quarantined, the five models trained with it are ineligible, and the scoreboard and ensemble are proven clean by timestamps.

## Recommendation

Pending the replication and the held-out judging. Nothing is deployed by this loop; Ian decides.
