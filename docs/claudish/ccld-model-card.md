# CCLD — Compact Claudish Language Detector: Model Card

A 36,950-byte binary classifier that runs on every keystroke at iampatterson.com/claudish and decides whether you type like a large language model. It is a reimplementation of Google's CLD3 architecture, trained on one person's Claude Code transcripts. This is exactly as serious as it sounds.

## Architecture

CLD3's shape: hashed character n-gram fractions (orders 1-4) into small embeddings, averaged, one ReLU layer (48 units), softmax over two classes. 27,026 parameters, quantized int8 symmetric per-tensor, shipped as 36,950 bytes of base64 JSON. Inference is dependency-free TypeScript and costs under 0.2ms at the 1,200-character input cap.

Two deliberate divergences from CLD3, because we detect punctuation habits, not scripts: spaces are included in n-grams (" — " — the spaced em dash — is the signal, and, as it turns out, the single most Claudish n-gram in the model), and the bucket counts are compact (96/512/1536/1024 x dim 8).

## Training data

Positive class: 33,406,371 characters of assistant prose from 2,001 Claude Code transcript files (22 parent sessions across 14 project directories), scrubbed (code, paths, URLs, secrets, money removed or chunk-dropped), deduplicated, and chunked to the runtime length distribution. 90,753 chunks in train after phrase damping (below).

Negative class, all authored pre-ChatGPT by source or construction: curl-docs 2,214, git-docs 14,683, hn 116,751, movie-dialogs 42,934, rust-book 6,464, usenet-1990s 22,309, wikipedia-2022 5,060, human-turns 3,042. Wikipedia negatives are revisions fetched AS OF 2022-11-30; movie-dialogs (Cornell, 2011) and usenet-1990s (20 Newsgroups) supply the CONVERSATIONAL register the first training round lacked — see the failure-mode section. The human-turns source is the author's own typed messages filtered by the regex heuristic (circular, capped at ~10%). The author declined to contribute his pre-2023 LinkedIn posts, which would have been the sharpest negatives; the model card you are reading is contractually obligated to mention this.

### Phrase damping, disclosed

Claude Code transcripts open workflow turns with "Let me ..." so relentlessly that 24% of positive chunks carried the phrase while the original formal-prose negatives contained it 18 times in 6MB — the first trained model learned "let me" as near-sufficient evidence (P≈0.998) and convicted "let me call my wife" at 0.80. A user minimal pair caught it. The fix, besides the conversational negatives: positives containing 'let me know' are excluded outright (closing boilerplate humans own), and other 'let me' chunks are subsampled to 5% (17,654 chunks dampened). The tic survives as a weak signal; it no longer convicts alone. Behavioral minimal pairs pin this in tests/unit/lib/claudish/ccld-behavior.test.ts.

## Results (quantized model — the one that ships)

| Split | n | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|
| dev | 33,104 | 92.0% | 90.3% | 87.4% | 88.8% |
| test | 36,987 | 93.3% | 92.6% | 91.0% | 91.8% |
| project-held-out | 6,494 | 93.1% | 100.0% | 93.1% | 96.4% |

Test confusion matrix at p=0.5: TP 13,821, FP 1,103, TN 20,694, FN 1,369. Brier 0.0509 after temperature scaling (T=1.1).

The project-held-out split (two whole project directories the model never saw) is the honest generalization number. It runs a few points below the session split — those held-out projects are workflow-dense, exactly where the phrase damping trades recall on purpose.

## Accuracy by input length — the table that predicts the keystroke UX

| Chars | n | Accuracy |
|---|---|---|
| 20-40 | 2,631 | 93.5% |
| 40-80 | 6,055 | 89.4% |
| 80-160 | 10,128 | 90.7% |
| 160-320 | 10,411 | 94.9% |
| 320-640 | 5,298 | 97.1% |
| 640-1200 | 2,464 | 98.5% |

Short inputs are where the model guesses with style — which is why the UI holds its previous state under 24 characters, latches "Claudish - detected" only at p >= 0.80, refuses to flip within 250ms, and (user decision) otherwise always claims a side: English - detected / Leaning English / Leaning Claudish / Claudish - detected. A terse workplace imperative like "let me check the numbers" may LEAN Claudish. The model has a point.

## Accuracy by negative source

| Source | n | Accuracy |
|---|---|---|
| claudish | 15,190 | 91.0% |
| hn | 11,762 | 95.2% |
| movie-dialogs | 4,504 | 97.9% |
| usenet-1990s | 2,374 | 92.3% |
| git-docs | 1,376 | 94.3% |
| rust-book | 738 | 91.1% |
| wikipedia-2022 | 727 | 91.2% |
| curl-docs | 175 | 87.4% |
| human-turns | 141 | 75.9% |

The formal-prose slice (wikipedia-2022, em dashes and all) holds near 98% — careful human writers are not called robots. The conversational slices (movie-dialogs, usenet-1990s) hold in the high 90s, which is what keeps "let me call my wife" out of the dock. The weakest slice is the author's own typed messages, which is either a filtering artifact or a diagnosis; the model declines to say which.

## The most Claudish n-grams, ranked

Logit-difference sensitivity at the mean positive feature vector, top 15. Hashing is not injective, so each row discloses its bucket's collisions — some credit is borrowed.

| n-gram | sensitivity | count | shares a bucket with |
|---|---|---|---|
| `*` | 0.535 | 20,837 | `↖, ̄` |
| `dj` | 0.510 | 255 | `jd, n(, :t` |
| `·—` | 0.488 | 3,657 | `ua, (f, 33` |
| `.*` | 0.468 | 954 | `e;, y/, <·` |
| `§` | 0.464 | 228 | `—` |
| `'d` | 0.449 | 454 | `éc, g…, →3` |
| `·—·` | 0.417 | 3,656 | `bus, r.", 33·` |
| `—t` | 0.414 | 120 | `91, l—, pj` |
| `1,` | 0.392 | 188 | `l;, /n, §6` |
| `dg` | 0.381 | 751 | `>5, ji, 4w` |
| `e_` | 0.376 | 356 | `);, o!, vv` |
| `gm` | 0.354 | 319 | `3), c9` |
| `tr` | 0.349 | 7,429 | `—·, b4, 7'` |
| `sq` | 0.327 | 252 | `,8` |
| `9·` | 0.316 | 251 | `bq, —e, 7b` |

Top-ranked this training round: `*`. The corpus contains 86,873 em dashes — 2.19 per message — and the spaced em dash sits in the top ranks of every model trained so far. "You're absolutely right" appears exactly once in 33.4MB, which makes the UI's thumbs-down label a monument to a phrase almost never actually said.

## Scope limits, stated plainly

This model detects ONE person's Claude, as captured in Claude Code transcripts over a few months of specific CLI versions, with that person's skills and CLAUDE.md files steering the register. It is not a general LLM detector. Paste GPT output into the box and the binary it actually computes is closer to "LLM-ish vs human." It has never seen poetry, other languages, or a teenager's text messages, and its opinions about them are not informed ones.

Known false positive, carried openly: third-person formal 'delves into' ("The book delves into medieval trade routes") convicts at ~0.95 — every model in the registry shares it, the ensemble can only raise scores, and the fix belongs to the next corpus round. Its counterpart in the launch UI is survivable: a history blurb reading as Claudish is the kind of wrong the joke absorbs.

Known floor, by construction: a character-n-gram model detects SURFACE tics, not rhetorical ones. Claude's subtle register — the self-aware concession ("You're right to push back on that"), the gracious deflection ("I'll resist the urge to explain why the six complaints are really three questions") — carries no em dash, no kill-list word, no contrastive scaffold, and scores as English. This sharpened after the conversational negatives landed: humans concede in exactly those words, constantly, and the model now knows it. A detector that convicted the concession register would convict every gracious human too. The candidate v2 lever is hashed word-unigram features (the ablation deliberately not shipped in v1); until then, Claude being subtle gets away with it — which is, on reflection, the correct joke.

Calibration: temperature scaling on dev; the enter/exit thresholds (0.80/0.55), the confident-English band (0.30/0.45), 24-char minimum, and 250ms dwell live in the shipped latch, not the model. The featurizer is frozen behind a SHA-256 configHash embedded in the weights; a mismatch refuses the model and detection falls back to the regex heuristic.

Numbers in this card are pinned to src/lib/claudish/ccld-metrics.json by a test; if they drift, the build says so. Regenerate with scripts/claudish/generate-model-card.py after every retrain.
