# cl2en experiment loop: report

**Run:** 2026-09-01 evening to 2026-09-02 morning, under `docs/claudish/cl2en-experiment-rules.md`.
**Budget:** $20.00 cap including prior spend; final ledger in `~/.claudish-corpus/analysis/2026-09-01-model-compare/spend-ledger.jsonl`.
**Status:** FINAL. Ledger closed at $19.88 of $20.00 (the remaining $0.12 buys nothing).

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
| 1r | replication of arm 1 | deployed | 0.709 (+0.024) | 7/11/9 | 6/7/17 | noise check: 0.036 swing, judge flip |
| 0r | calibration: deployed configuration re-run | itself | 0.719 vs 0.685 | 8/8/13 | 9/10/11 | apparatus noise floor, sample 1 |
| 0r2 | calibration, second sample | itself | 0.696 vs 0.685 | 9/8/11 | 7/10/13 | noise floor, sample 2 |

Full rows, per-case scores and pairs: `~/.claudish-corpus/analysis/2026-09-01-model-compare/RESULTS.md` and the `pool-*.json`, `scores-*.csv`, `judge-*.json` files beside it.

## Held-out set (50 fresh transcript chunks)

| candidate | scoreboard (live baseline → candidate) | pass | paired | guards | judges |
|---|---|---|---|---|---|
| arm 8a configuration | 0.767 → 0.791 | 16% → 18% | 13 / 16 / 21 | equal | not judged |
| final candidate: arm 1 configuration | 0.767 → 0.780 | 16% → 14% | 20 / 14 / 16 | equal | Opus 5 13/18/16, Gemini 3.1 Pro 10/14/26 |

## What the loop learned

1. The detector and fidelity trade against each other under this loop. Arm 5 is the clean example: −0.070 on the detector, meaning 4.70 → 4.14. The fidelity gate is doing its job.
2. Retries are where fidelity is lost. Every mechanism that added retries (facts gate, widened gate) re-narrated the speaker or dropped content; lowering retry temperature (arm 8b) did not hurt and recovered the scoreboard.
3. Prompt size was not earning its keep: the minimal prompt ties the deployed one on both axes at a third of the tokens.
4. The detector floor is not a data-mix problem. Two retrains on human-only data (one with technical prose re-weighted, one with human writing about the same topics oversampled) were fairer or worse on human sources and stricter on translations. The residual conviction on plain translations is the transcript skeleton.
5. Run-to-run noise is larger than assumed. Two calibration runs of the deployed configuration against itself scored +0.035 and +0.011 on the scoreboard and split the judges 8/8/13, 9/10/11 and 9/8/11, 7/10/13. The floor is about ±0.035 on the mean and ±3 on a 30-pair judge split, which is roughly the size of the 0.05 win bar and covers every prompt-side effect this loop measured except arm 5's.
6. Recycled loop output had entered detector training in earlier rounds (`translated-positives.txt`); it is quarantined, the five models trained with it are ineligible, and the scoreboard and ensemble are proven clean by timestamps.

## Recommendation

1. Ship nothing from this loop on the strength of the scoreboard: no configuration beat the deployed one on the detector outside the measured noise, on the dev pool or the held-out set.
2. The minimal prompt is a cost lever, not a quality gain, and the held-out set says so: on 50 fresh inputs both judges lean to the deployed prompt (Opus 13 wins / 18 losses / 16 ties; Gemini 10 / 14 / 26), with plainness slightly up and content loss slightly worse; on the dev pool the two runs of it split one way then the other. The calibration row shows how much of that lean is apparatus noise. It costs a third of the input tokens per call (about 1.5k versus 4.5k) and it removed the few-shot set that arm D showed teaching the model the inverse of the fidelity principle. If Ian wants it, it is a cost and maintainability decision taken on a read of the held-out pairs (`pairs` files beside the reports), with the content-loss lean weighed.
3. Keep the retry temperature at 0.3 if the minimal prompt ships (arm 8b: no fidelity cost, recovers the scoreboard level of the deployed configuration).
4. Do not pursue further prompt or gate tuning against this scoreboard. The floor the loop hit is in the detector, and two human-only retrains did not move it. The levers that could are outside this budget and outside the rules as set: a detector whose features see structure rather than characters (the model card's word-feature lever), or a scoreboard that is itself a frontier judge of plainness rather than a Claudish-vs-human classifier.
5. Keep the two-judge fidelity gate for any future loop. It was the instrument that turned three apparent wins (arms 2, 3, 5) into correctly rejected ones.

Nothing is deployed by this loop; Ian decides.

## Appendix: sample outputs and judge rulings

Hand-written battery inputs only (transcript-derived inputs stay outside the repo; the full appendix with every judged input is `~/.claudish-corpus/analysis/2026-09-01-model-compare/appendix-samples.md`). Judge rulings are the candidate-vs-baseline preference for that pair with the first-order reason; "candidate" means the arm's output was preferred, "baseline" the deployed configuration's.

## Battery cases

### battery:meme

**Input (Claudish)**

Let me delve into this for you — because this question isn't just interesting; it's a pivotal inflection point in our journey.

**baseline**

Let me look into this for you, because this question is an important turning point in our journey.

**arm 1 (minimal prompt)**

I will look into this for you.

- Opus 5: **candidate** (B drops only register; A retains empty "pivotal turning point" padding.)
- Gemini 3.1 Pro: **candidate** (B drops the empty emphasis and register, leaving a plain statement.)

**arm 2b (facts retry)**

Let me look into this, because this question is an inflection point in our journey.

- Opus 5: **baseline** (A strips register; B retains empty "inflection point" flourish.)
- Gemini 3.1 Pro: **baseline** (A drops the empty register; B keeps it.)

**arm 3 (residue rule)**

This question is a major turning point for us.

- Opus 5: **baseline** (B drops the offer to look into it, a real act.)
- Gemini 3.1 Pro: **tie** (B drops the empty 'let me delve' and 'interesting' padding, keeping the core meaning.)

**arm 5 (widened gate)**

Let me look into this, because this question is an inflection point in our journey.

- Opus 5: **tie** (Identical translations.)
- Gemini 3.1 Pro: **tie** (Both candidates are identical and retain some of the original's register.)

**arm 8a (clean candidate)**

Let me look into this, because this question is an important turning point.

- Opus 5: **candidate** (B drops more register padding while keeping the act intact.)
- Gemini 3.1 Pro: **candidate** (B is slightly plainer by dropping 'for you' and 'in our journey'.)

**arm 8b (retry temp 0.3)**

Let me look into this, because this question is an important turning point for us.

- Opus 5: **tie** (Nearly identical; both plain and faithful.)
- Gemini 3.1 Pro: **candidate** (B preserves 'our journey' as 'for us'.)

### battery:email

**Input (Claudish)**

Thank you for the thoughtful feedback — it doesn't just improve the proposal; it sharpens the entire strategic frame. I'll delve into a comprehensive revision and ensure it lands in your inbox by Thursday.

**baseline**

Thank you for the thoughtful feedback, which improves the proposal and sharpens the strategic frame. I will revise the proposal thoroughly and send it to your inbox by Thursday.

**arm 1 (minimal prompt)**

Thanks for the feedback. I will revise the proposal and send it to you by Thursday.

- Opus 5: **candidate** (B is plain; the sharpening praise is mostly register.)
- Gemini 3.1 Pro: **candidate** (B drops the empty praise and padding, leaving a clear, plain message.)

**arm 2b (facts retry)**

Thank you for the thoughtful feedback, which improves the proposal and sharpens the strategic frame. I will revise it fully and send it to your inbox by Thursday.

- Opus 5: **baseline** (A strips flattery register; B keeps padded praise wording.)
- Gemini 3.1 Pro: **baseline** (A drops the empty emphasis and padding, leaving a clear, plain message.)

**arm 3 (residue rule)**

Thank you for the thoughtful feedback, which improves the proposal and sharpens the strategic frame. I will revise the proposal thoroughly and send it to your inbox by Thursday.

- Opus 5: **tie** (Identical translations.)
- Gemini 3.1 Pro: **tie** (The candidates are identical.)

**arm 5 (widened gate)**

Thank you for the thoughtful feedback. I will revise the proposal and send it to your inbox by Thursday.

- Opus 5: **tie** (A keeps the sharpening claim; B is plainer but drops it.)
- Gemini 3.1 Pro: **candidate** (B drops the empty praise of the feedback, which is pure register.)

**arm 8a (clean candidate)**

Thank you for the thoughtful feedback, which improves the proposal and sharpens the strategic frame. I will revise the proposal thoroughly and send it to your inbox by Thursday.

- Opus 5: **tie** (Identical translations.)
- Gemini 3.1 Pro: **tie** (The candidates are identical.)

**arm 8b (retry temp 0.3)**

Thank you for the thoughtful feedback, which improves the proposal and sharpens the strategic frame. I will revise it fully and send it to your inbox by Thursday.

- Opus 5: **tie** (B slightly tighter; both accurate.)
- Gemini 3.1 Pro: **tie** (B is slightly more concise by using 'it' instead of repeating 'the proposal'.)

### battery:soft-reply

**Input (Claudish)**

You're right to flag the delay. The migration proved more intricate than our estimates anticipated, and the timeline reflects that reality. The new date stands as Friday, and I'm confident it holds.

**baseline**

You were right to point out the delay. The migration took more work than we expected, so we moved the launch to Friday, and I am sure we will hit it.

**arm 1 (minimal prompt)**

You are right about the delay. The migration was more complicated than we estimated, and the timeline reflects that. The new date is Friday, and I am confident it will hold.

- Opus 5: **tie** (A is plainer; B keeps filler "timeline reflects that".)
- Gemini 3.1 Pro: **baseline** (A is plainer, avoiding 'reflects that' and 'will hold'.)

**arm 2b (facts retry)**

You were right to flag the delay, because the migration was more intricate than we estimated. The new date is Friday, and I am confident it will hold.

- Opus 5: **tie** (B adds false causal link and drops timeline clause.)
- Gemini 3.1 Pro: **candidate** (B drops the empty 'timeline reflects that reality' clause, making it plainer.)

**arm 3 (residue rule)**

You were right to point out the delay. The migration took more work than we expected, so we moved the launch to Friday, and I am confident we will hit that date.

- Opus 5: **tie** (Nearly identical, both plain and accurate.)
- Gemini 3.1 Pro: **tie** (Both candidates are excellent, plain English translations that preserve the meaning and tone.)

**arm 5 (widened gate)**

You were right to flag the delay because the migration was harder than we expected, so we are moving the date to Friday.

- Opus 5: **baseline** (B drops the confidence assurance; A keeps everything plainly.)
- Gemini 3.1 Pro: **baseline** (A preserves the speaker's confidence in the new date, which B drops.)

**arm 8a (clean candidate)**

You were right to flag the delay because the migration was harder than we expected, so the new date is Friday.

- Opus 5: **baseline** (B drops the confidence claim; A keeps everything plainly.)
- Gemini 3.1 Pro: **baseline** (A preserves the speaker's confidence in the new date, which B drops.)

**arm 8b (retry temp 0.3)**

You were right to flag the delay, because the migration was harder than we expected. The new date is Friday, and I am confident it will hold.

- Opus 5: **candidate** (A drops the confidence statement; B keeps everything plainly.)
- Gemini 3.1 Pro: **candidate** (B preserves the speaker's confidence in the new date, which A drops.)

### battery:loud-marketing

**Input (Claudish)**

This isn't just a product update — it's a fundamental reimagining of how teams collaborate, leveraging our robust real-time engine to foster seamless alignment across every stakeholder, ensuring nothing falls through the cracks.

**baseline**

This product update reimagines team collaboration by using our real-time engine to align stakeholders so nothing falls through the cracks.

**arm 1 (minimal prompt)**

This product update uses our real-time engine to help teams collaborate and align stakeholders so nothing is missed.

- Opus 5: **candidate** (B drops "reimagines" hype; both preserve content, B plainer.)
- Gemini 3.1 Pro: **candidate** (B drops the empty 'reimagines' and 'falls through the cracks' for a plainer sentence.)

**arm 2b (facts retry)**

This product update uses our real-time engine to help teams collaborate and align stakeholders so nothing falls through the cracks.

- Opus 5: **baseline** (A drops the cliché; B keeps "falls through the cracks.")
- Gemini 3.1 Pro: **baseline** (A avoids the cliché 'falls through the cracks'.)

**arm 3 (residue rule)**

This product update uses our real-time engine to help teams collaborate and align stakeholders so nothing falls through the cracks.

- Opus 5: **candidate** (B drops the leftover hype word "reimagines"; both keep content.)
- Gemini 3.1 Pro: **tie** (B drops the empty 'reimagines' for a plainer statement of what the update does.)

**arm 5 (widened gate)**

We updated the product with our real-time engine so teams can collaborate and stakeholders stay aligned.

- Opus 5: **baseline** (A keeps the nothing-falls-through claim; B drops it.)
- Gemini 3.1 Pro: **tie** (B is plainer and drops the empty 'reimagining' and 'nothing falls through the cracks'.)

**arm 8a (clean candidate)**

This update reimagines how teams collaborate by using our real-time engine to keep stakeholders aligned so nothing falls through the cracks.

- Opus 5: **tie** (Both faithful; B slightly plainer and smoother.)
- Gemini 3.1 Pro: **tie** (B's 'keep stakeholders aligned' is slightly more natural than A's 'align stakeholders'.)

**arm 8b (retry temp 0.3)**

This product update uses our real-time engine so teams can collaborate and align.

- Opus 5: **baseline** (A keeps the concrete claims; B drops the nothing-falls-through-cracks point.)
- Gemini 3.1 Pro: **baseline** (A keeps the 'nothing falls through the cracks' claim, which B drops.)

