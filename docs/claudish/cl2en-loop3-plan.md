# cl2en experiment loop 3: register-labelled positives

Approved by Ian 2026-09-02 ("You get it, do another experiment round"). Rules: `docs/claudish/cl2en-experiment-rules.md` as amended by loop 2, plus the amendments below. Budget assumed at $20.00 like loops 1 and 2; ledger `~/.claudish-corpus/analysis/2026-09-01-model-compare/loop3-ledger.jsonl`.

**Product definition, confirmed by Ian 2026-09-02.** Claudish is the register, not the author. Claude speaks English and often says things that read as plain English; the joke exists when it slips into the register, saying things and shaping sentences the way no English-speaking human would. The input box should therefore say English on plain Claude text and Claudish on register-bearing text, whoever wrote it. This is the definition the loop-3 labels implement and the one the detector is measured against from here.

## 1. The problem this loop targets

The product's claim is that Claudish is a register and cl2en removes it. The shipped detector's positive class is authorship (every chunk Claude wrote), so a plain Claude reply is a positive by construction and a translated Claude reply convicts. Loop 2 showed no data mix or feature family separates the two under the authorship label. The roundtrip is the moment this fails in front of a visitor: 56% of loop-1 baseline cl2en outputs pass the served latch (enter 0.80); 44% flip the input box to "Claudish - detected".

## 2. The change

Relabel the positive class by register. A frozen frontier judge scores corpus chunks on a rubric for register strength, independent of topic and of who wrote the text. Claude chunks that carry the register become positives; Claude chunks the judge calls plain become negatives (a new source, `claude-plain`), alongside the human negatives. Nothing the translator produced is labelled or trained on. Labels are on corpus chunks only.

Rubric (frozen; the judge prompt in `scripts/claudish/cl2en-lab/register-label.ts` is the authoritative text): score 0 to 4 for how strongly a passage carries the Claudish register: contrastive negation ("this isn't X, it's Y"), spaced em-dash flourishes, tidy consequence clauses that summarise significance, reflexive framing and validation ("you're absolutely right", "great question"), bold-led list polish, hedged omniscience, the closing restatement. Topic, correctness, and whether an AI wrote it are explicitly not the question. 0 = no trace; 1 = a stray tic; 2 = noticeable; 3 = clearly the register; 4 = unmistakable.

Judges: primary Gemini 3.1 Pro (`gemini-3.1-pro-preview`, temperature 0, ten chunks per call, JSON scores); calibration overlap of 300 chunks with Opus 5 (`claude-opus-5`, effort low). Agreement between the two, and a read of a sample by the operator, are reported before any training.

Sample: stratified, about 9,000 chunks: 2,000 Claude Code turn-final, 2,000 Claude Code mid-work, 4,000 claude.ai replies, 1,000 human chunks across sources (rubric calibration: human text should mostly score 0 to 1; a human chunk scoring 3 or more is a legitimate positive under this definition and is kept as one).

## 3. Measures

- Human FPR by source on the new test split (existing script), including the new `claude-plain` negatives: the number that says whether plain Claude reads as English.
- Recall on register-bearing text: judged score >= 3 on the test split, plus the 99 loud Claudish inputs of the cl2en pool (evaluation only).
- Judge-agreement on the loop-1 baseline translations (existing measure; acquittal of the 19 judge-plain outputs).
- Roundtrip pass rate: share of the 99 baseline cl2en outputs under the served latch's 0.80, and under 0.5. Baseline 56% / 25%. This is the product metric and it is computed on outputs the detector never trained on.
- Parity gate and size as always; r7d stays the reported scoreboard for cl2en.

## 4. Arms

- L1 Label the sample (about $5). Report judge agreement and the score distribution by stratum.
- D1 Train on register labels: positives score >= 3, `claude-plain` negatives score <= 1, scores 2 dropped; human negatives at the loop-2 D1 mix, downweighted to balance. v2 mask featurizer (shipped loader, no featurizer change). Cost $0.
- D2 Same with the v6 structure features if D1 is close on recall. Cost $0.
- D3 If D1 clears the measures, self-training: label the remaining corpus with D1 (not with the translator) and retrain; report whether it holds. Cost $0.
- T1 Only if a candidate clears every measure: the loop under the candidate judge on the 99-input pool with both frozen fidelity judges, as in loop 2's T1 design (about $2.30 with held-out).

## 5. Rule amendments for loop 3

1. Labels come from a frozen judge on corpus chunks. No label is ever produced on translator output, and no translator output enters training.
2. Human FPR on `claude-plain` is a first-class measure: a candidate that convicts plain Claude text is not a register detector.
3. Recall is measured on register-bearing text (judged >= 3) and on the loud pool inputs, not on all Claude text, because the definition changed.
4. Threshold amendment (2026-09-02, after calibration on 300 chunks): Gemini 3.1 Pro runs about half a point below Opus 5 (Spearman +0.72, 93% within one point), and at Gemini >= 3 the sample yields a few hundred positives. Positives are Gemini >= 2 (which pairs with Opus 3 on the overlap, the "clearly the register" level), `claude-plain` is Gemini <= 1, nothing is dropped, and the labelled sample was extended to about 27,000 chunks. The phrase dampers are off under labels (the judge decides what "Let me" chunks are). <antThinking>/<antArtifact> tags in claude.ai chunks are stripped from training text (ids hash the raw text the judge saw).
5. Everything else from loops 1 and 2 stands: no cross-session memory, ledger, r7d reported, Ian decides adoption and shipping.

## 6. Stopping and reporting

Stop at $20.00 or when the arms are exhausted. Report: label agreement and distribution, the candidates' measures table, the roundtrip pass rate against baseline, the T1 result if it ran, and a Decision entry.
