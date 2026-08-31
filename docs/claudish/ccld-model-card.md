# CCLD — Compact Claudish Language Detector: Model Card

A 36.9KB binary classifier that runs on every keystroke at iampatterson.com/claudish and decides whether you type like a large language model. It is a reimplementation of Google's CLD3 architecture, trained on one person's Claude Code transcripts. This is exactly as serious as it sounds.

## Architecture

CLD3's shape: hashed character n-gram fractions (orders 1-4) into small embeddings, averaged, one ReLU layer (48 units), softmax over two classes. 27,026 parameters, quantized int8 symmetric per-tensor, shipped as 36952 bytes of base64 JSON. Inference is dependency-free TypeScript and costs under 0.2ms at the 1,200-character input cap.

Two deliberate divergences from CLD3, because we detect punctuation habits, not scripts: spaces are included in n-grams (" — " — the spaced em dash — is the signal, and, as it turns out, the single most Claudish n-gram in the model), and the bucket counts are compact (96/512/1536/1024 x dim 8).

## Training data

Positive class: 33,406,371 characters of assistant prose from 2,001 Claude Code transcript files (22 parent sessions across 14 project directories, CLI versions spanning months), scrubbed (code, paths, URLs, secrets, money removed or chunk-dropped), deduplicated, and chunked to the runtime length distribution. 25,326 chunks in train.

Negative class, all authored on or before 2022-11-30 (pre-ChatGPT), by source: curl-docs 2,214, git-docs 14,703, rust-book 6,492, wikipedia-2022 4,963, human-turns 3,013. Wikipedia negatives are revisions fetched AS OF the cutoff date, not current pages. The human-turns source is the author's own typed messages filtered by the regex heuristic to remove pasted model output — a circular filter, which is why that source is capped at ~10% of the class. The author declined to contribute his pre-2023 LinkedIn posts, which would have been the sharpest negatives; the model card you are reading is contractually obligated to mention this.

## Results (quantized model — the one that ships)

| Split | n | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|
| dev | 4,373 | 94.5% | 91.9% | 92.5% | 92.2% |
| test | 15,669 | 97.8% | 99.1% | 98.2% | 98.6% |
| project-held-out | 9,854 | 97.0% | 100.0% | 97.0% | 98.5% |

Test confusion matrix at p=0.5: TP 12,226, FP 108, TN 3,105, FN 230. Brier 0.0181 after temperature scaling (T=1.2).

The project-held-out split (two whole project directories the model never saw) is the honest generalization number: 97.0% vs 97.8% on the session split. A gap under a point says the model learned the tics, not the clients' vocabulary.

## Accuracy by input length — the table that predicts the keystroke UX

| Chars | n | Accuracy |
|---|---|---|
| 20-40 | 530 | 92.8% |
| 40-80 | 2,477 | 94.9% |
| 80-160 | 4,611 | 97.5% |
| 160-320 | 4,231 | 98.7% |
| 320-640 | 2,371 | 99.8% |
| 640-1200 | 1,449 | 99.9% |

Below 80 characters the model is guessing with style. This is why the UI holds its previous state under 24 characters, latches "Claudish - detected" only at p >= 0.80, and refuses to flip again within 250ms. A terse imperative like "The meeting moved to Thursday. Bring the numbers." scores 0.72 — Claudish-adjacent, deliberately sub-latch. Yes, the model thinks short confident sentences sound like Claude. The model has a point.

## Accuracy by negative source

| Source | n | Accuracy |
|---|---|---|
| claudish | 12,456 | 98.2% |
| git-docs | 1,397 | 97.5% |
| rust-book | 767 | 96.0% |
| wikipedia-2022 | 737 | 98.0% |
| curl-docs | 168 | 95.2% |
| human-turns | 144 | 86.8% |

The formal-prose slice (wikipedia-2022, em dashes and all) holds at ~98% — the false-positive rate on careful human writers stays around 2%, well under the 10% bar that would have forced a threshold raise. The weakest slice is the author's own typed messages (86.8%), which is either a filtering artifact or a diagnosis; the model declines to say which.

## The most Claudish n-grams, ranked

Logit-difference sensitivity at the mean positive feature vector, top 15. Hashing is not injective, so each row discloses its bucket's collisions — some credit is borrowed.

| n-gram | sensitivity | count | shares a bucket with |
|---|---|---|---|
| `·—·` | 0.761 | 6,905 | `bus, n"*, r."` |
| `t·—` | 0.479 | 632 | `·6,, rm/, *§9` |
| `·→·` | 0.430 | 775 | `024, "gu, 3,9` |
| `·**` | 0.424 | 5,591 | `ow., nim, d·…` |
| `**·` | 0.399 | 4,908 | `:·", c·c, 1·a` |
| `.*` | 0.345 | 1,475 | `e;, y/, <·` |
| `·—` | 0.339 | 6,905 | `ua, (f, q-` |
| `):·` | 0.338 | 419 | `"·e, md., 41,` |
| `-ga` | 0.316 | 221 | `enf, ;·b, 5.6` |
| `dge` | 0.299 | 658 | `**,, ttl, :·.` |
| `—·` | 0.291 | 6,905 | `tr, b4, 7'` |
| `,·s` | 0.290 | 1,861 | `d·+, (v1, e-5` |
| `e/` | 0.288 | 177 | `y;, "j, 4…` |
| `uin` | 0.283 | 328 | `ne), p-s, ec,` |
| `—·t` | 0.278 | 1,464 | `n-c, s·q, h·"` |

The spaced em dash is #1. The corpus contains 86,873 em dashes — one every ~385 characters, 2.19 per message. "You're absolutely right" appears exactly once in 33.4MB, which makes the UI's thumbs-down label a monument to a phrase almost never actually said.

## Scope limits, stated plainly

This model detects ONE person's Claude, as captured in Claude Code transcripts over a few months of specific CLI versions, with that person's skills and CLAUDE.md files steering the register. It is not a general LLM detector. Paste GPT output into the box and the binary it actually computes is closer to "LLM-ish vs human." It has never seen poetry, other languages, or a teenager's text messages, and its opinions about them are not informed ones.

Calibration: temperature scaling on dev; the enter/exit thresholds (0.80/0.55), 24-char minimum, and 250ms dwell live in the shipped latch, not the model. The featurizer is frozen behind a SHA-256 configHash embedded in the weights; a mismatch refuses the model and detection falls back to the regex heuristic.

Numbers in this card are pinned to src/lib/claudish/ccld-metrics.json by a test; if they drift, the build says so.
