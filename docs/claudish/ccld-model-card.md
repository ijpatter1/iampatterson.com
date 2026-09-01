# CCLD — Compact Claudish Language Detector: Model Card

A 36,951-byte binary classifier that runs on every keystroke at iampatterson.com/claudish and decides whether you type like a large language model. It is a reimplementation of Google's CLD3 architecture, trained on one person's Claude Code transcripts. This is exactly as serious as it sounds.

## Architecture

CLD3's shape: hashed character n-gram fractions (orders 1-4) into small embeddings, averaged, one ReLU layer (48 units), softmax over two classes. 27,026 parameters, quantized int8 symmetric per-tensor, shipped as 36,951 bytes of base64 JSON. Inference is dependency-free TypeScript and costs under 0.2ms at the 1,200-character input cap.

Two deliberate divergences from CLD3, because we detect punctuation habits, not scripts: spaces are included in n-grams (" — " — the spaced em dash — is the signal, and, as it turns out, the single most Claudish n-gram in the model), and the bucket counts are compact (96/512/1536/1024 x dim 8).

## Training data

Positive class: 33,406,371 characters of assistant prose from 2,001 Claude Code transcript files (22 parent sessions across 14 project directories), scrubbed (code, paths, URLs, secrets, money removed or chunk-dropped), deduplicated, and chunked to the runtime length distribution. 70,233 chunks in train after phrase damping (below).

Negative class, all authored pre-ChatGPT by source or construction: curl-docs 2,214, git-docs 14,683, movie-dialogs 42,935, rust-book 6,443, usenet-1990s 22,219, wikipedia-2022 5,018, human-turns 3,036. Wikipedia negatives are revisions fetched AS OF 2022-11-30; movie-dialogs (Cornell, 2011) and usenet-1990s (20 Newsgroups) supply the CONVERSATIONAL register the first training round lacked — see the failure-mode section. The human-turns source is the author's own typed messages filtered by the regex heuristic (circular, capped at ~10%). The author declined to contribute his pre-2023 LinkedIn posts, which would have been the sharpest negatives; the model card you are reading is contractually obligated to mention this.

### Phrase damping, disclosed

Claude Code transcripts open workflow turns with "Let me ..." so relentlessly that 24% of positive chunks carried the phrase while the original formal-prose negatives contained it 18 times in 6MB — the first trained model learned "let me" as near-sufficient evidence (P≈0.998) and convicted "let me call my wife" at 0.80. A user minimal pair caught it. The fix, besides the conversational negatives: positives containing 'let me know' are excluded outright (closing boilerplate humans own), and other 'let me' chunks are subsampled to 5% (17,654 chunks dampened). The tic survives as a weak signal; it no longer convicts alone. Behavioral minimal pairs pin this in tests/unit/lib/claudish/ccld-behavior.test.ts.

## Results (quantized model — the one that ships)

| Split | n | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|
| dev | 10,505 | 95.9% | 81.1% | 90.1% | 85.4% |
| test | 19,258 | 97.2% | 96.8% | 97.5% | 97.1% |
| project-held-out | 6,396 | 94.8% | 100.0% | 94.8% | 97.3% |

Test confusion matrix at p=0.5: TP 9,006, FP 302, TN 9,715, FN 235. Brier 0.0219 after temperature scaling (T=1.25).

The project-held-out split (two whole project directories the model never saw) is the honest generalization number. It runs a few points below the session split — those held-out projects are workflow-dense, exactly where the phrase damping trades recall on purpose.

## Accuracy by input length — the table that predicts the keystroke UX

| Chars | n | Accuracy |
|---|---|---|
| 20-40 | 2,396 | 95.7% |
| 40-80 | 4,315 | 95.0% |
| 80-160 | 4,837 | 96.6% |
| 160-320 | 4,077 | 98.7% |
| 320-640 | 2,246 | 99.8% |
| 640-1200 | 1,387 | 99.9% |

Short inputs are where the model guesses with style — which is why the UI holds its previous state under 24 characters, latches "Claudish - detected" only at p >= 0.80, refuses to flip within 250ms, and (user decision) otherwise always claims a side: English - detected / Leaning English / Leaning Claudish / Claudish - detected. A terse workplace imperative like "let me check the numbers" may LEAN Claudish. The model has a point.

## Accuracy by negative source

| Source | n | Accuracy |
|---|---|---|
| claudish | 9,241 | 97.5% |
| movie-dialogs | 4,534 | 98.8% |
| usenet-1990s | 2,342 | 96.2% |
| git-docs | 1,353 | 95.5% |
| wikipedia-2022 | 749 | 97.9% |
| rust-book | 715 | 94.0% |
| curl-docs | 176 | 94.3% |
| human-turns | 148 | 81.8% |

The formal-prose slice (wikipedia-2022, em dashes and all) holds near 98% — careful human writers are not called robots. The conversational slices (movie-dialogs, usenet-1990s) hold in the high 90s, which is what keeps "let me call my wife" out of the dock. The weakest slice is the author's own typed messages, which is either a filtering artifact or a diagnosis; the model declines to say which.

## The most Claudish n-grams, ranked

Logit-difference sensitivity at the mean positive feature vector, top 15. Hashing is not injective, so each row discloses its bucket's collisions — some credit is borrowed.

| n-gram | sensitivity | count | shares a bucket with |
|---|---|---|---|
| `·—·` | 0.568 | 7,580 | `bus, t_w, n"*` |
| `·—` | 0.364 | 7,583 | `ua, (f, q-` |
| `.*` | 0.352 | 1,637 | `e;, y/, "~` |
| `·→·` | 0.342 | 858 | `"gu, 024, (w3` |
| `**·` | 0.327 | 5,805 | `:·", c·c, 1·a` |
| `t·—` | 0.303 | 681 | `rm/, ·6,, 0–5` |
| `("` | 0.281 | 369 | `qi, g3, &l` |
| `·**` | 0.265 | 6,590 | `ow., nim, g/n` |
| `—·` | 0.261 | 7,581 | `tr, 7', b4` |
| `·20` | 0.256 | 457 | `r**, pr·, iet` |
| `uta` | 0.247 | 391 | `ilu, up-, 4·t` |
| `d_` | 0.245 | 375 | `g*, qp, "≈` |
| `-ga` | 0.244 | 239 | `enf, 5.6, ;·b` |
| `1,` | 0.240 | 309 | `/n, §6, l;` |
| `oog` | 0.235 | 254 | `**1, y.*, 1·p` |

The spaced em dash is #1. The corpus contains 86,873 em dashes — 2.19 per message. "You're absolutely right" appears exactly once in 33.4MB, which makes the UI's thumbs-down label a monument to a phrase almost never actually said.

## Scope limits, stated plainly

This model detects ONE person's Claude, as captured in Claude Code transcripts over a few months of specific CLI versions, with that person's skills and CLAUDE.md files steering the register. It is not a general LLM detector. Paste GPT output into the box and the binary it actually computes is closer to "LLM-ish vs human." It has never seen poetry, other languages, or a teenager's text messages, and its opinions about them are not informed ones.

Known false positive, carried openly: third-person formal 'delves into' ("The book delves into medieval trade routes") convicts at ~0.95 — every model in the registry shares it, the ensemble can only raise scores, and the fix belongs to the next corpus round. Its counterpart in the launch UI is survivable: a history blurb reading as Claudish is the kind of wrong the joke absorbs.

Known floor, by construction: a character-n-gram model detects SURFACE tics, not rhetorical ones. Claude's subtle register — the self-aware concession ("You're right to push back on that"), the gracious deflection ("I'll resist the urge to explain why the six complaints are really three questions") — carries no em dash, no kill-list word, no contrastive scaffold, and scores as English. This sharpened after the conversational negatives landed: humans concede in exactly those words, constantly, and the model now knows it. A detector that convicted the concession register would convict every gracious human too. The candidate v2 lever is hashed word-unigram features (the ablation deliberately not shipped in v1); until then, Claude being subtle gets away with it — which is, on reflection, the correct joke.

Calibration: temperature scaling on dev; the enter/exit thresholds (0.80/0.55), the confident-English band (0.30/0.45), 24-char minimum, and 250ms dwell live in the shipped latch, not the model. The featurizer is frozen behind a SHA-256 configHash embedded in the weights; a mismatch refuses the model and detection falls back to the regex heuristic.

Numbers in this card are pinned to src/lib/claudish/ccld-metrics.json by a test; if they drift, the build says so. Regenerate with scripts/claudish/generate-model-card.py after every retrain.
