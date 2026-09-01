#!/usr/bin/env python3
"""Regenerate docs/claudish/ccld-model-card.md from the live artifacts.

Reads ccld-metrics.json + ~/.claudish-corpus/{corpus-report,dataset-summary}.json
so the card can never drift from the numbers (a Jest test pins the match).
Run after every retrain: python3 scripts/claudish/generate-model-card.py
"""
import io
import json
import os

metrics = json.load(io.open('src/lib/claudish/ccld-metrics.json'))
report = json.load(io.open(os.path.expanduser('~/.claudish-corpus/corpus-report.json')))
dataset = json.load(io.open(os.path.expanduser('~/.claudish-corpus/dataset-summary.json')))
weights_bytes = os.path.getsize('src/lib/claudish/ccld-weights.json')


def pct(x):
    return f"{x * 100:.1f}%"


conf = metrics['test']['confusion']
lines = []
add = lines.append
add('# CCLD — Compact Claudish Language Detector: Model Card')
add('')
add('A %s-byte binary classifier that runs on every keystroke at iampatterson.com/claudish and decides whether you type like a large language model. It is a reimplementation of Google\'s CLD3 architecture, trained on one person\'s Claude Code transcripts. This is exactly as serious as it sounds.' % f"{weights_bytes:,}")
add('')
add('## Architecture')
add('')
add("CLD3's shape: hashed character n-gram fractions (orders 1-4) into small embeddings, averaged, one ReLU layer (48 units), softmax over two classes. 27,026 parameters, quantized int8 symmetric per-tensor, shipped as %s bytes of base64 JSON. Inference is dependency-free TypeScript and costs under 0.2ms at the 1,200-character input cap." % f"{weights_bytes:,}")
add('')
add('Two deliberate divergences from CLD3, because we detect punctuation habits, not scripts: spaces are included in n-grams (" — " — the spaced em dash — is the signal, and, as it turns out, the single most Claudish n-gram in the model), and the bucket counts are compact (96/512/1536/1024 x dim 8).')
add('')
add('## Training data')
add('')
add(f"Positive class: {report['assistantChars']:,} characters of assistant prose from {report['files']:,} Claude Code transcript files ({report['sessions']} parent sessions across {report['projects']} project directories), scrubbed (code, paths, URLs, secrets, money removed or chunk-dropped), deduplicated, and chunked to the runtime length distribution. {dataset['train']['pos']:,} chunks in train after phrase damping (below).")
add('')
add("Negative class, all authored pre-ChatGPT by source or construction: " + ", ".join(f"{k} {v:,}" for k, v in dataset['negBySource'].items()) + ". Wikipedia negatives are revisions fetched AS OF 2022-11-30; movie-dialogs (Cornell, 2011) and usenet-1990s (20 Newsgroups) supply the CONVERSATIONAL register the first training round lacked — see the failure-mode section. The human-turns source is the author's own typed messages filtered by the regex heuristic (circular, capped at ~10%). The author declined to contribute his pre-2023 LinkedIn posts, which would have been the sharpest negatives; the model card you are reading is contractually obligated to mention this.")
add('')
add('### Phrase damping, disclosed')
add('')
add(f"Claude Code transcripts open workflow turns with \"Let me ...\" so relentlessly that 24% of positive chunks carried the phrase while the original formal-prose negatives contained it 18 times in 6MB — the first trained model learned \"let me\" as near-sufficient evidence (P≈0.998) and convicted \"let me call my wife\" at 0.80. A user minimal pair caught it. The fix, besides the conversational negatives: positives containing 'let me know' are excluded outright (closing boilerplate humans own), and other 'let me' chunks are subsampled to 5% ({dataset.get('positivesDampened', 0):,} chunks dampened). The tic survives as a weak signal; it no longer convicts alone. Behavioral minimal pairs pin this in tests/unit/lib/claudish/ccld-behavior.test.ts.")
add('')
add('## Results (quantized model — the one that ships)')
add('')
add('| Split | n | Accuracy | Precision | Recall | F1 |')
add('|---|---|---|---|---|---|')
for name, key in [('dev', 'dev'), ('test', 'test'), ('project-held-out', 'projectHeldOut')]:
    s = metrics[key]
    add(f"| {name} | {s['n']:,} | {pct(s['accuracy'])} | {pct(s['precision'])} | {pct(s['recall'])} | {pct(s['f1'])} |")
add('')
add(f"Test confusion matrix at p=0.5: TP {conf['tp']:,}, FP {conf['fp']:,}, TN {conf['tn']:,}, FN {conf['fn']:,}. Brier {metrics['test']['brier']:.4f} after temperature scaling (T={metrics['temperature']}).")
add('')
add('The project-held-out split (two whole project directories the model never saw) is the honest generalization number. It runs a few points below the session split — those held-out projects are workflow-dense, exactly where the phrase damping trades recall on purpose.')
add('')
add('## Accuracy by input length — the table that predicts the keystroke UX')
add('')
add('| Chars | n | Accuracy |')
add('|---|---|---|')
for k in ['20-40', '40-80', '80-160', '160-320', '320-640', '640-1200']:
    v = metrics['test']['byLength'].get(k)
    if v:
        add(f"| {k} | {v['n']:,} | {pct(v['accuracy'])} |")
add('')
add('Short inputs are where the model guesses with style — which is why the UI holds its previous state under 24 characters, latches "Claudish - detected" only at p >= 0.80, refuses to flip within 250ms, and (user decision) otherwise always claims a side: English - detected / Leaning English / Leaning Claudish / Claudish - detected. A terse workplace imperative like "let me check the numbers" may LEAN Claudish. The model has a point.')
add('')
add('## Accuracy by negative source')
add('')
add('| Source | n | Accuracy |')
add('|---|---|---|')
for k, v in sorted(metrics['test']['bySource'].items(), key=lambda kv: -kv[1]['n']):
    add(f"| {k} | {v['n']:,} | {pct(v['accuracy'])} |")
add('')
add("The formal-prose slice (wikipedia-2022, em dashes and all) holds near 98% — careful human writers are not called robots. The conversational slices (movie-dialogs, usenet-1990s) hold in the high 90s, which is what keeps \"let me call my wife\" out of the dock. The weakest slice is the author's own typed messages, which is either a filtering artifact or a diagnosis; the model declines to say which.")
add('')
add('## The most Claudish n-grams, ranked')
add('')
add('Logit-difference sensitivity at the mean positive feature vector, top 15. Hashing is not injective, so each row discloses its bucket\'s collisions — some credit is borrowed.')
add('')
add('| n-gram | sensitivity | count | shares a bucket with |')
add('|---|---|---|---|')
for g in metrics['topNgrams'][:15]:
    gram = g['gram'].replace('|', '\\|').replace(' ', '·')
    cols = ', '.join(c.replace('|', '\\|').replace(' ', '·') for c in g['collisions'][:3]) or '—'
    add(f"| `{gram}` | {g['sensitivity']:.3f} | {g['count']:,} | `{cols}` |")
add('')
add(f"The spaced em dash is #1. The corpus contains {report['emDash']['total']:,} em dashes — {report['emDash']['perMessage']} per message. \"You're absolutely right\" appears exactly once in 33.4MB, which makes the UI's thumbs-down label a monument to a phrase almost never actually said.")
add('')
add('## Scope limits, stated plainly')
add('')
add("This model detects ONE person's Claude, as captured in Claude Code transcripts over a few months of specific CLI versions, with that person's skills and CLAUDE.md files steering the register. It is not a general LLM detector. Paste GPT output into the box and the binary it actually computes is closer to \"LLM-ish vs human.\" It has never seen poetry, other languages, or a teenager's text messages, and its opinions about them are not informed ones.")
add('')
add("Known false positive, carried openly: third-person formal 'delves into' (\"The book delves into medieval trade routes\") convicts at ~0.95 — every model in the registry shares it, the ensemble can only raise scores, and the fix belongs to the next corpus round. Its counterpart in the launch UI is survivable: a history blurb reading as Claudish is the kind of wrong the joke absorbs.")
add('')
add("Known floor, by construction: a character-n-gram model detects SURFACE tics, not rhetorical ones. Claude's subtle register — the self-aware concession (\"You're right to push back on that\"), the gracious deflection (\"I'll resist the urge to explain why the six complaints are really three questions\") — carries no em dash, no kill-list word, no contrastive scaffold, and scores as English. This sharpened after the conversational negatives landed: humans concede in exactly those words, constantly, and the model now knows it. A detector that convicted the concession register would convict every gracious human too. The candidate v2 lever is hashed word-unigram features (the ablation deliberately not shipped in v1); until then, Claude being subtle gets away with it — which is, on reflection, the correct joke.")
add('')
add("Calibration: temperature scaling on dev; the enter/exit thresholds (0.80/0.55), the confident-English band (0.30/0.45), 24-char minimum, and 250ms dwell live in the shipped latch, not the model. The featurizer is frozen behind a SHA-256 configHash embedded in the weights; a mismatch refuses the model and detection falls back to the regex heuristic.")
add('')
add('Numbers in this card are pinned to src/lib/claudish/ccld-metrics.json by a test; if they drift, the build says so. Regenerate with scripts/claudish/generate-model-card.py after every retrain.')

io.open('docs/claudish/ccld-model-card.md', 'w').write('\n'.join(lines) + '\n')
print(f'model card regenerated ({len(lines)} lines)')
