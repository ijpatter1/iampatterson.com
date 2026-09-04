#!/usr/bin/env python3
"""Regenerate the proxy's vendored judge weights from the local model registry.

Usage: python3 scripts/claudish/vendor-judge-weights.py <judgeTag> [<referenceTag>]

JUDGE_WEIGHTS is the cl2en loop's judge (loop 3: the register detector; Claudish is
the register, not the author, see docs/claudish/cl2en-loop3-report.md). An optional
REFERENCE_WEIGHTS is vendored only so the lab seam test in judge.test.ts can swap a
genuinely different member in; the proxy never serves it. Emitted as TypeScript so
the Docker build (tsc -> dist) stays self-contained. Weights come from
~/.claudish-corpus/models/<tag>/ccld-weights.json; no corpus text is involved.
"""
import datetime
import json
import os
import sys

REGISTRY = os.path.expanduser('~/.claudish-corpus/models')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'infrastructure', 'cloud-run', 'claudish-proxy', 'src', 'vendor', 'judge-weights.ts')
NAMES = ['JUDGE_WEIGHTS', 'REFERENCE_WEIGHTS']

tags = sys.argv[1:]
if not 1 <= len(tags) <= 2:
    sys.exit(__doc__)
lines = [
    '/**',
    ' * Judge weights, vendored from the model registry (~/.claudish-corpus/models)',
    f' * {datetime.date.today().isoformat()} by scripts/claudish/vendor-judge-weights.py.',
    ' * JUDGE_WEIGHTS is the cl2en loop judge: the loop-3 register detector (Claudish is the',
    ' * register, not the author; docs/claudish/cl2en-loop3-report.md). REFERENCE_WEIGHTS is',
    ' * the retired authorship model, kept only so the lab seam test can swap a genuinely',
    ' * different member in; it is never served. Emitted as TypeScript so the Docker build',
    ' * (tsc -> dist) stays self-contained. Behavior-pinned in judge.test.ts.',
    ' */',
]
for name, tag in zip(NAMES, tags):
    weights = json.load(open(os.path.join(REGISTRY, tag, 'ccld-weights.json')))
    lines.append(f'/** {tag} */')
    lines.append(f'export const {name}: unknown = {json.dumps(weights, separators=(",", ":"))};')
with open(os.path.normpath(OUT), 'w') as f:
    f.write('\n'.join(lines) + '\n')
print(f'vendored {tags} -> {os.path.normpath(OUT)}')
