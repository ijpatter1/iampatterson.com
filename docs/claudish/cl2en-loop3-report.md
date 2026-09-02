# cl2en experiment loop 3: register-labelled positives

Date: 2026-09-02. Plan: `docs/claudish/cl2en-loop3-plan.md`. Running record and per-candidate logs: `~/.claudish-corpus/analysis/2026-09-01-model-compare/loop3-RESULTS.md` (local corpus workspace, never in the repo).

## Summary

Loop 3 changed what the detector is taught to mean by Claudish: the register, not the author. A frozen frontier judge scored 26,989 corpus chunks 0 to 4 on a register rubric; Claude chunks that carry it became positives, Claude chunks the judge called plain became a new negative source, and the human negatives stayed. Two rounds of self-training extended the labels across the corpus with the candidate model, never the translator. The result is a detector that convicts under 2% of every human source, acquits two thirds of plain Claude text, acquits 18 of the 19 translations both fidelity judges rated plain, and turns the roundtrip pass rate from 56% to 98%. It still misses about a fifth of register-bearing text and a sixth of the translator's own Claudish on its own, which the served heuristic covers to 97%. The loop under that detector as its judge accepts 94 to 98% of first attempts, costs a tenth as much, and is preferred by both fidelity judges on the 50 held-out inputs. Nothing shipped; the adoption call and a latch threshold re-read are Ian's.

Product definition confirmed by Ian during the loop: Claude speaks English and often says plain things; the joke exists when it slips into the register. The input box should say English on plain Claude text and Claudish on register-bearing text, whoever wrote it.

## Labels

- Rubric: register strength 0 to 4, topic and authorship explicitly excluded (authoritative text in `scripts/claudish/cl2en-lab/register-label.ts`). Judge: Gemini 3.1 Pro, temperature 0, ten chunks per call, JSON scores, nothing unparsed. Calibration: Opus 5 on the first 300 chunks, Spearman +0.72, 93% within one point, Opus about half a point higher.
- Sample: 6,000 Claude Code turn-final blocks, 6,000 mid-work blocks, 14,000 claude.ai replies, 989 human chunks across 16 sources. Cost $14.68 including calibration.
- Distribution (share scoring 2 or above): claude.ai replies 17%, turn-final 10%, mid-work 5%, human 0% (99% score 0). Most of Claude's own prose is plain under the register definition; the register lives in roughly one chunk in ten.
- Threshold amendment, recorded before training: positives are score 2 or above (Gemini's 2 pairs with Opus's 3 on the overlap), plain is 1 or below; at the plan's 3 the sample would have yielded a few hundred positives.

## Candidates

All evaluated on judge-labelled test rows the models never trained on; recall at 0.5.

| measure | shipped r7d | r25 judge labels only | r27 self-training round 1, structure features | r28 round 2, strong positives x3 |
|---|---|---|---|---|
| training positives / negatives | 69,683 / 69,683 | 2,499 / 4,847 | 13,491 / 25,225 | 73,736 / 94,082 |
| register-bearing chunks caught (n=360) | 98.1% | 79.4% | 73.3% | 81.7% |
| of which judge score 3 (n=60) | | 85% | 87% | 93% |
| plain Claude convicted (n=3,883) | 91.7% | 45.5% | 24.6% | 33.2% |
| human false positives, worst source | 44.4% (topic probe) | 15.9% (movie dialogue) | 1.2% (topic probe) | 7.4% (topic probe) |
| human false positives, every other source | 2 to 35% | 3 to 12% | 0.1 to 0.7% | 0.1 to 1.6% |
| judge-plain translations acquitted (of 19) | 5 | 14 | 18 | 18 |
| roundtrip pass at the served latch 0.80 | 56% | 100% | 99% | 98% |
| en2cl outputs caught, model alone (n=30) | 97% | 60% | 70% | 83% |
| en2cl outputs caught, served max with heuristic | 100% | 100% | 93% | 97% |

Self-training: round 1 used r25 as teacher gated by the shipped regex heuristic (a pseudo-positive needed two heuristic families), which drove human false positives to near zero and narrowed recall toward what the heuristic sees; round 2 used r27 without the gate and repeated the judge's 3 and 4 chunks three times in training, which bought back recall on the register at the cost of nine points on plain Claude. The two are the ends of one trade.

## What changed and what did not

The register definition removed the topic problem loop 2 could not: the human probe on Claude-transcript subjects went from 44% convicted to 1 to 7%, and plain human prose from any source reads as English. It also removed the roundtrip contradiction: a plain translation now has training negatives that look like it.

What it costs is recall on the mild end of the register (score 2, "noticeably present but mostly plain") and on the translator's own output when the model stands alone. The served detector already takes the larger of the model score and the heuristic, and the heuristic alone catches 90% of en2cl outputs, so in the product the loud side stays covered while the model does the acquittal work.

The served latch (enter 0.80, exit 0.55) was tuned for the authorship model. r28's operating curve: at 0.5, loud recall 0.78 and roundtrip pass 0.96; at 0.8, 0.65 and 0.98. Adopting a register model means re-reading that threshold on judge-labelled rows, which is a product decision.

## T1: the loop under the register judge

Configuration: deployed prompt, default gates, facts retry off, retry temperature 0.3, and the loop's judge replaced by r28 alone through the lab seam (the two remaining vendored members are authorship models and would out-vote it). Independent intent check before the run: PASS WITH DISCLOSURE (self-training domain shift, covered by the scoreboard, guards and both fidelity judges). The first run was invalid: a one-member ensemble read the median at index 1 of a one-element array, every verdict was NaN, and the loop never consulted r28. That is fixed in the proxy judge with a test that demands a finite score; the $0.80 is in the ledger.

Valid run, 99-input dev pool, against the loop-1 baseline (the same prompt under the r7d ensemble):

| | baseline (r7d ensemble as judge) | T1 (r28 as judge) |
|---|---|---|
| loop accepted at attempt 1 | 25% | 94% |
| translation cost, 99 inputs | | $0.085 |
| shipped scoreboard r7d, mean | 0.685 | 0.759 |
| outputs passing the served latch under r7d | 56% | 37% |
| outputs passing the served latch under r28 | 98% | 98% |
| guards: identifiers / first person / numbers lost | | 12 / 8 / 3, compression 0.90 |
| Opus 5, candidate / baseline / tie (30 pairs, both orders) | | 11 / 8 / 11 |
| Gemini 3.1 Pro | | 7 / 5 / 18 |
| Opus 5 meaning, speaker (baseline vs candidate) | 4.53, 4.57 | 4.68, 4.67 |
| Gemini meaning, speaker | 4.92, 4.95 | 4.88, 4.85 |

Reading. Under the register judge the loop keeps its first attempt almost every time, which is where loop 1 showed meaning survives, and both frontier judges call the result equivalent to the baseline, Opus leaning slightly to the candidate. The shipped scoreboard rises because the loop has stopped chasing the authorship detector, and the same outputs roundtrip at 98% under r28. This is the expected shape: the register judge changes what the loop optimises, not how well the translator writes.

Held-out, 50 reserved inputs never used for tuning, both judges, both orders:

| | baseline | T1 |
|---|---|---|
| loop accepted at attempt 1 | | 98% |
| guards: identifiers / numbers / first person lost | 13 / 4 / 1 | 11 / 3 / 0 |
| Opus 5, candidate / baseline / tie | | 19 / 13 / 13 (5 unparsed) |
| Opus 5 meaning, speaker | 4.42, 4.44 | 4.53, 4.67 |
| Gemini 3.1 Pro, candidate / baseline / tie | | 17 / 11 / 22 |
| Gemini meaning, speaker | 4.76, 4.50 | 4.81, 4.87 |

On held-out both judges lean to the candidate, and the clearest gain is speaker preservation: fewer retries means less of the first-person drift that loop 1 traced to the refinement turns. T1 is the first translator arm in three loops that both judges prefer.

## Budget

Ledger in `loop3-ledger.jsonl`: labelling and calibration $14.68, T1 invalid run $0.80, T1 $0.77, held-out judging $1.18; total $17.43 of $20.00. Detector training CPU only.

## What landed

- `register-label.ts`: the frozen-rubric labeller, resumable, no text logged, cost to the ledger.
- Builder: `POS_LABELS` with `POS_MIN_REGISTER` / `NEG_MAX_REGISTER`, the `claude-plain` negative source with weight `CLAUDE_PLAIN`, `POS_STRONG_OVERSAMPLE`, ant-tag stripping for claude.ai chunks (label ids hash the raw text the judge saw).
- Lab scripts in the analysis folder: pseudo-labelling with a candidate plus heuristic co-teacher, judge-labelled evaluation, latch operating curve, loud-input recall by input type, roundtrip pass rate.
- Frontend weights and the served ensemble unchanged.

## Recommendation

1. Adopt the register definition for the product detector, with r28 as the candidate, after re-reading the latch on judge-labelled rows: at 0.5 it gives loud recall 0.78 and roundtrip pass 0.96; at 0.8, 0.65 and 0.98. The served heuristic covers the loud side either way.
2. Put r28 in the loop's judge seat for cl2en, alone or as a new vendored trio built from register models, and retire the r7d scoreboard for the translator: it measures authorship, which the product no longer claims to remove.
3. Keep the rules that made this honest: no translator output in training or labelling, no cross-session memory of outputs. The labels are on corpus chunks and the judge is frozen; regenerating them is a documented, resumable $15.
