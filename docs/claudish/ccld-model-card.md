# CCLD — Compact Claudish Language Detector: Model Card

A 38,488-byte binary classifier that runs on every keystroke at iampatterson.com/claudish and decides whether you type like a large language model. It is a reimplementation of Google's CLD3 architecture, trained on one person's Claude conversations, labelled for the register rather than the author since loop 3. This is exactly as serious as it sounds.

## Architecture

CLD3's shape: hashed character n-gram fractions (orders 1-4) into small embeddings, averaged, plus 23 dense register and sentence-shape features concatenated to the embedding average (featurizer v6), one ReLU layer (48 units), softmax over two classes. 28,130 parameters, quantized int8 symmetric per-tensor, shipped as 38,488 bytes of base64 JSON. Inference is dependency-free TypeScript; measured in Node on 2026-09-01 it costs 0.6ms for 1,200 characters and 1.6ms at the 3,000-character input cap (linear in length, well inside a keystroke).

Two deliberate divergences from CLD3, because we detect punctuation habits, not scripts: spaces are included in n-grams (" — " — the spaced em dash — is the signal, and, as it turns out, the single most Claudish n-gram in the model), and the bucket counts are compact (96/512/1536/1024 x dim 8).

## Training data

**Definition (loop 3, 2026-09-02): Claudish is the register, not the author.** The positive class is Claude prose that a frozen frontier judge (Gemini 3.1 Pro, rubric in `scripts/claudish/cl2en-lab/register-label.ts`, calibrated against Opus 5 on 300 chunks) scored 2 or higher for the Claudish register; Claude prose the judge scored 0 or 1 is a NEGATIVE source (`claude-plain`). Judge labels cover about 27,000 chunks; the rest of the corpus was labelled by two rounds of self-training with the candidate model as teacher, never with translator output. Consequence: a plain Claude reply reads as English here, by design.

Positive class: register-bearing chunks from 2,070 Claude Code transcript files (22 parent sessions, 14 project directories) and the claude.ai conversation export, selected by label: 35,663 judge/teacher positives; 73,137 Claude chunks labelled plain moved to the negative class; 34,950 unlabelled chunks unused.

Negative class, all authored pre-ChatGPT by source or construction: claude-topic 178, curl-docs 2,228, enron-ham 6,351, git-docs 14,675, github-comments 10,931, hn 116,626, mdn-http 3,538, movie-dialogs 42,982, plainlanguage 3,792, rust-book 6,491, simple-wikipedia 170, so-topic 11,552, stackexchange 6,528, usenet-1990s 22,259, wikipedia-2022 5,014, claude-plain 73,137, human-turns 3,044. Wikipedia negatives are revisions fetched AS OF 2022-11-30; movie-dialogs (Cornell, 2011) and usenet-1990s (20 Newsgroups) supply the CONVERSATIONAL register the first training round lacked — see the failure-mode section. The human-turns source is the author's own typed messages filtered by the regex heuristic (circular, capped at ~10%). The author declined to contribute his pre-2023 LinkedIn posts, which would have been the sharpest negatives; the model card you are reading is contractually obligated to mention this.

### Phrase damping, disclosed

Claude Code transcripts open workflow turns with "Let me ..." so relentlessly that 24% of positive chunks carried the phrase while the original formal-prose negatives contained it 18 times in 6MB — the first trained model learned "let me" as near-sufficient evidence (P≈0.998) and convicted "let me call my wife" at 0.80. A user minimal pair caught it. The fix, besides the conversational negatives: positives containing 'let me know' are excluded outright (closing boilerplate humans own), and other 'let me' chunks are subsampled to 5% (296 chunks dampened). The tic survives as a weak signal; it no longer convicts alone. Behavioral minimal pairs pin this in tests/unit/lib/claudish/ccld-behavior.test.ts.

## Results (quantized model — the one that ships)

| Split | n | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|
| dev | 35,348 | 97.3% | 80.3% | 96.5% | 87.7% |
| test | 44,586 | 96.5% | 74.3% | 97.7% | 84.4% |
| project-held-out | 2,052 | 97.8% | 100.0% | 97.8% | 98.9% |

Test confusion matrix at p=0.5: TP 4,263, FP 1,472, TN 38,751, FN 100. Brier 0.0281 after temperature scaling (T=1.15).

The project-held-out split (two whole project directories the model never saw) is the honest generalization number. It runs a few points below the session split — those held-out projects are workflow-dense, exactly where the phrase damping trades recall on purpose.

## Accuracy by input length — the table that predicts the keystroke UX

| Chars | n | Accuracy |
|---|---|---|
| 20-40 | 2,922 | 99.2% |
| 40-80 | 7,682 | 99.3% |
| 80-160 | 13,454 | 98.7% |
| 160-320 | 11,806 | 96.0% |
| 320-640 | 5,882 | 91.1% |
| 640-1200 | 2,840 | 88.4% |

Short inputs are where the model guesses with style — which is why the UI holds its previous state under 24 characters, latches "Claudish - detected" only at p >= 0.80, refuses to flip within 250ms, and (user decision) otherwise always claims a side: English - detected / Leaning English / Leaning Claudish / Claudish - detected. A terse workplace imperative like "let me check the numbers" may LEAN Claudish. The model has a point.

## Accuracy by negative source

| Source | n | Accuracy |
|---|---|---|
| claude-plain | 14,322 | 90.9% |
| hn | 11,722 | 99.3% |
| movie-dialogs | 4,536 | 99.5% |
| claudish | 4,363 | 97.7% |
| usenet-1990s | 2,364 | 99.9% |
| git-docs | 1,378 | 100.0% |
| so-topic | 1,262 | 99.1% |
| github-comments | 1,050 | 98.5% |
| wikipedia-2022 | 741 | 98.4% |
| enron-ham | 718 | 99.9% |
| rust-book | 713 | 100.0% |
| stackexchange | 452 | 99.3% |
| mdn-http | 360 | 98.6% |
| plainlanguage | 206 | 97.6% |
| curl-docs | 179 | 100.0% |
| human-turns | 139 | 98.6% |
| claude-topic | 81 | 92.6% |

The formal-prose slice (wikipedia-2022, em dashes and all) holds near 98% — careful human writers are not called robots. The conversational slices (movie-dialogs, usenet-1990s) hold in the high 90s, which is what keeps "let me call my wife" out of the dock. The weakest slice is the author's own typed messages, which is either a filtering artifact or a diagnosis; the model declines to say which.

## The most Claudish n-grams, ranked

Logit-difference sensitivity at the mean positive feature vector, top 15. Hashing is not injective, so each row discloses its bucket's collisions — some credit is borrowed.

| n-gram | sensitivity | count | shares a bucket with |
|---|---|---|---|
| `desi` | 0.344 | 803 | `uine, lds·, ke·m` |
| `.·*` | 0.322 | 3,009 | `-ch, lio, ry-` |
| `ic·` | 0.320 | 3,136 | `y·y, -ta, w·g` |
| `nsi` | 0.314 | 2,285 | `·ea, 5%·, y·3` |
| `l·v` | 0.312 | 293 | `dee, obs, giz` |
| `tua` | 0.306 | 1,906 | `*th, wav, 0·—` |
| `ctu` | 0.306 | 3,457 | `aps, en-, ·nd` |
| `u·l` | 0.292 | 302 | `env, ·16, ;·r` |
| `d·y` | 0.290 | 722 | `et,, e-g, lch` |
| `.·th` | 0.281 | 5,159 | `unit, g·fa, .tes` |
| `tly` | 0.279 | 2,549 | `·gl, .2], uzz` |
| `oic` | 0.270 | 366 | `aks, l-d, ksm` |
| `hes` | 0.260 | 1,736 | `slo, ·6., rm-` |
| `·ai` | 0.257 | 992 | `tow, -lo, lks` |
| `.·t` | 0.257 | 5,550 | `re', o·m, aul` |

Top-ranked this training round: `desi`. The corpus contains 87,920 em dashes — 2.19 per message — and the spaced em dash sits in the top ranks of every model trained so far. "You're absolutely right" appears exactly once in 33.4MB, which makes the UI's thumbs-down label a monument to a phrase almost never actually said.

The dev/test/held-out numbers above are on the merged label set (judge plus teacher labels). On judge-labelled test rows only, the loop-3 report records: register-bearing chunks caught 81.7% (93% of those the judge scored 3), plain Claude convicted 33.2%, human sources 0.1 to 1.6% (topic probe 7.4%). Those are the honest numbers for this definition; the table above is what the trainer saw.

## Scope limits, stated plainly

This model detects ONE person's Claude, as captured in Claude Code transcripts over a few months of specific CLI versions, with that person's skills and CLAUDE.md files steering the register. It is not a general LLM detector. Paste GPT output into the box and the binary it actually computes is closer to "LLM-ish vs human." It has never seen poetry, other languages, or a teenager's text messages, and its opinions about them are not informed ones.

Known false positive, carried openly: third-person formal 'delves into' ("The book delves into medieval trade routes") convicts at ~0.95 — every model in the registry shares it, the ensemble can only raise scores, and the fix belongs to the next corpus round. Its counterpart in the launch UI is survivable: a history blurb reading as Claudish is the kind of wrong the joke absorbs.

Known floor, by construction: a character-n-gram model detects SURFACE tics, not rhetorical ones. Claude's subtle register — the self-aware concession ("You're right to push back on that"), the gracious deflection ("I'll resist the urge to explain why the six complaints are really three questions") — carries no em dash, no kill-list word, no contrastive scaffold, and scores as English. This sharpened after the conversational negatives landed: humans concede in exactly those words, constantly, and the model now knows it. A detector that convicted the concession register would convict every gracious human too. The candidate v2 lever is hashed word-unigram features (the ablation deliberately not shipped in v1); until then, Claude being subtle gets away with it — which is, on reflection, the correct joke.

Input length, after the 2026-09-01 cap change: training chunks topped out at 1,200 characters; the translator now accepts 3,000. Character-n-gram fractions are length-normalized, so longer inputs are not out of distribution by construction, and a spot-check on the two long golden inputs (a 2,264-character English post and a 2,892-character Claudish post) scored 0.27 and 0.96 — the right way round. The accuracy-by-length table above still stops at 1,200 because the eval set does; a long-input bucket belongs to the next corpus round.

Calibration: temperature scaling on dev; the enter/exit thresholds (0.80/0.55), the confident-English band (0.30/0.45), 24-char minimum, and 250ms dwell live in the shipped latch, not the model. The featurizer is frozen behind a SHA-256 configHash embedded in the weights; a mismatch refuses the model and detection falls back to the regex heuristic.

Numbers in this card are pinned to src/lib/claudish/ccld-metrics.json by a test; if they drift, the build says so. Regenerate with scripts/claudish/generate-model-card.py after every retrain.
