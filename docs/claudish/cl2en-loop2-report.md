# cl2en experiment loop 2: final report

Date: 2026-09-02. Plan: `docs/claudish/cl2en-loop2-plan.md`. Rules: `docs/claudish/cl2en-experiment-rules.md` with the loop-2 amendments in the plan. Running record and per-candidate logs: `~/.claudish-corpus/analysis/2026-09-01-model-compare/loop2-RESULTS.md` (local corpus workspace, never in the repo).

## Summary

Loop 2 set out to fix the scoreboard's error rather than the prompt: build a detector candidate that convicts Claudish and acquits plain human prose about technical work, then run the translator loop under it. Eight candidates were trained and measured on human false-positive rate by source, Claudish recall on held-out transcripts, and agreement with the frontier judges on the loop-1 translations. None clears both selection measures, so no translator arm ran. Spend: $0.00 of the $20.00 budget. The detector work was CPU-only, and the judge-agreement measure reuses loop 1's judge rulings.

The finding is specific. What the shipped detector calls Claudish in a plain translation is the translation's topic, and the topic is entangled with the positive class because the positive class is one person's Claude Code transcripts. Human negatives that share the register but not the topic fix false positives on their own sources and leave the translations alone. Word-level features make it worse. The only lever that moved the translations was human text on the transcripts' own topics, and it moved recall on held-out transcripts down with it, which is the same fact seen from the other side.

## Candidates

Reference: r7d (shipped) acquits 5 of the 19 judge-plain translations, mean detector score on them 0.697, held-out recall 0.910 on the 1,500-chunk sample.

| candidate | change | human FPR, notable moves (r7d to candidate) | held-out recall | judge-plain acquitted (of 19) | mean score on them | verdict |
|---|---|---|---|---|---|---|
| r14 D1 | plain human prose: Simple Wikipedia, MDN, gov plain-language, Enron, Stack Exchange | MDN 31.5 to 9.1, plain-language 33.3 to 17.6, Enron 3.4 to 0.1; Usenet and Wikipedia worse | 0.919 | 3 | 0.706 | fixes plain prose, not translations |
| r15 D1b | 6,162 pre-cutoff GitHub issue/PR comments | GitHub 8.6 to 5.0, MDN 33.3 to 8.3; HN 6.0 to 10.7, Usenet 6.0 to 9.7 | 0.903 | 2 | 0.746 | convicts translations more |
| r19 D1c | 5,167 pre-cutoff, tag-matched Stack Overflow posts | SO-topic 13.7 to 3.6, MDN 33.3 to 8.3, topic probe 41.4 to 37.1 | 0.886 | 6 | 0.654 | only right-direction move; fails the recall floor |
| r21 D1c-strong | SO-topic at 0.35, topic probe oversampled | topic probe 41.4 to 44.3, HN 6.0 to 13.7, Usenet 5.5 to 12.1 | 0.917 | 4 | 0.733 | recovers recall, loses the gain |
| r16 D2 | v5: hashed word unigram and bigram tables | MDN 33.3 to 10.3; curl, SO-topic, HN, Usenet worse | 0.933 | 4 | 0.752 | word tables learn topic as register |
| r17 D3 | v6: 12 sentence-shape structure statistics | broadest FPR fix: MDN 33.3 to 5.0, human turns 29.5 to 16.5, rust-book 9.3 to 3.5 | 0.894 | 5 | 0.699 | no movement on translations; recall just under the floor |
| r18 D4 | v7: word tables + register + structure | best accuracy (dev 0.929, test 0.939); topic probe 41.4 to 47.1 | 0.925 | 4 | 0.764 | most accurate and most topic-bound |
| r20 D4 | D1c data with v6 | SO-topic 13.7 to 5.9; topic probe unchanged | 0.897 | 5 | 0.720 | structure cancels the data gain |

Recall is the share of held-out Claude-transcript chunks scored at or above 0.5. Two held-out samples exist and disagree by about two points: the source-by-source script's sample puts r7d at 0.910, the full 883-chunk file puts it at 0.888. The floor was applied to the first for every candidate, r7d included; the second is reported below for the ensemble view. Neither sample was chosen after the fact.

## What convicts a plain translation

The 19 translations both frontier judges rated plain (4.5 or above on 5) and every candidate still convicts are short, polished, single-sentence summaries about this codebase's own subjects. Three of them, with the shipped detector's score and the judges' plainness:

- "Yes. The pricing model works with usage tiers, which helps adoption and revenue." (0.87; plain 5.00)
- "You must return a LOW confidence signal with a reason when the lift or its range is NULL, instead of inventing high confidence without evidence." (0.91; plain 4.86)
- "The refactor gives connection state a single source of truth so the retry logic and the offline recovery path use the same reliable backoff primitive." (0.86; plain 5.00)

The probe for this is the `claude-topic` source: Ian's own pre-existing user turns about Claude and models, human by construction, on the transcripts' subjects. Every candidate convicts 33 to 47 percent of it. Every candidate acquits 91 to 100 percent of MDN pages, Simple Wikipedia, plain-language government text, and Stack Overflow answers once those are in training. The register is separable from plainness; it is not separable from the topic with this positive class.

Word tables (D2, D4) sharpen the point. Given a vocabulary channel, the model uses it to learn the transcripts' words as Claudish, because no human negative carries them at scale. Structure features (D3) are the broadest false-positive fix of the loop and do nothing for the translations, which says the translations are not convicted on sentence shape.

## Ensemble view (informational, outside the selection rule)

The loop judge is the median of three detectors, taken against the heuristic. Rule 3 applies the recall floor to the candidate alone, and D1c fails it. As information for the decision, here is the judge as T1 would have computed it, on the full 883-chunk held-out file:

| ensemble | judge-plain acquitted (of 19) | mean score on them | held-out recall |
|---|---|---|---|
| median(r3, r6h, r7d) shipped | 4 | 0.713 | 0.904 |
| median(r3, r6h, r19 D1c) | 6 | 0.689 | 0.901 |
| median(r3, r6h, r17 D3) | 4 | 0.701 | 0.905 |

The ensemble absorbs D1c's recall loss and keeps its acquittals. Two more acquittals out of nineteen is inside the loop-1 noise band, and the rule was written before the data, so the loop did not act on this. It is the one number that argues for a T1 run at about $2.30; the case against is that the gain is one or two outputs and every other candidate says the residual is topic.

## Why no translator arm ran

The plan gates T1 on a candidate that acquits more judge-plain translations while keeping recall at or above 0.90. D1c meets the first and misses the second by 1.4 points; every other candidate misses the first. Running T1 under a judge that failed the floor would test a judge the rule already rejected, and running it under r7d would repeat loop 1. The held-out evaluation applies to translator arms and therefore has nothing to evaluate. The budget is intact.

## What landed

- Featurizer v5 (hashed word tables as extra embedding orders), v6 (twelve sentence-shape statistics after the register vector), v7 (both), blessed by hash in the frontend and proxy loaders, with the trainer switch and vendor copies. Frontend weights unchanged.
- Trainer fixes found by the v5 runs: gradient tables, the quantizer, and the model-card ranking all counted character tables only; the exporter and both loaders hard-coded eight tensor names, so word tables were written under the hidden-layer names. Each is pinned by a test, and the arm runner now refuses to archive without a successful export. The first D2 run had silently re-archived D1's weights under the D2 tag; it was caught by hashing the archives and removed.
- Two fetchers with manifests: pre-cutoff GitHub issue and PR comments (walks forward from 2021 and stops at the cutoff) and tag-matched Stack Overflow questions and answers (created and last edited before the cutoff).
- A lab seam to run the loop under a candidate judge: `setJudgeModels` on the proxy judge, test-pinned, with `LOOP_JUDGE_MODELS` in the lab runner. The served ensemble is unchanged.

## Recommendation

1. Stop detector-side work on the cl2en scoreboard. Two loops and fifteen candidates say the shipped detector's disagreement with the judges on plain translations is topic, and topic cannot be removed from a positive class that is one person's transcripts about one set of subjects.
2. If the scoreboard is to improve, the change is on the positive side: Claude-written text on subjects the transcripts never touch. The rules forbid training on en2cl or cl2en outputs, which is right, so this means new positives from outside the translator, and it is a corpus decision for Ian, not a loop arm.
3. The one cheap test the loop left on the table is T1 under the D1c ensemble, about $2.30 including held-out judging. The loop did not run it because the rule excludes the candidate; Ian can overrule the rule with the ensemble numbers above in view.
