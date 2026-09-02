"""Loop convergence summary for cl2en-local.ts reports.
Usage: python3 convergence.py report.json [report.json ...]
Served p here is the loop's judge ensemble (max(median(r3,r6h,r7d), heuristic))."""
import json
import statistics as st
import sys
from collections import Counter

EPS_DEFAULT = 0.03


def analyse(path):
    d = json.load(open(path))
    rows = d['cl2en']
    n = len(rows)
    att = [len(r['attempts']) for r in rows]
    first = [r['attempts'][0]['p'] for r in rows]
    best = [min(a['p'] for a in r['attempts']) for r in rows]
    served = [r['p'] for r in rows]
    retried = [r for r in rows if len(r['attempts']) > 1]
    stop1 = Counter()
    for r in rows:
        a = r['attempts']
        if a[0]['p'] < 0.5:
            stop1['passed on 1'] += 1
        elif not a[0]['actionable']:
            stop1['convicted, gate closed'] += 1
        elif len(a) == 1:
            stop1['gate open, no retry'] += 1
        else:
            stop1['retried'] += 1
    gains = []
    improved_any = 0
    for r in retried:
        a = r['attempts']
        deltas = [a[i - 1]['p'] - a[i]['p'] for i in range(1, len(a))]
        gains += deltas
        if any(dl >= EPS_DEFAULT for dl in deltas):
            improved_any += 1
    revised = sum(1 for r in rows if r['revised'])
    by_k = [sum(1 for r in rows if any(a['p'] < 0.5 for a in r['attempts'][:k])) for k in range(1, 6)]
    tot_in = sum(r['usage']['inputTokens'] for r in rows)
    tot_out = sum(r['usage']['outputTokens'] for r in rows)
    print(f"== {path.split('/')[-1]}  model={d['modelId']} (n={n})")
    print(f"   attempts mean {st.mean(att):.2f} dist {dict(sorted(Counter(att).items()))}; stop after 1: {dict(stop1)}")
    print(f"   first-draft mean p {st.mean(first):.3f}; retried {len(retried)}, improved>=0.03 at least once {improved_any}")
    print(f"   per-retry gain mean {st.mean(gains):+.3f} median {st.median(gains):+.3f}; worse-retry share {sum(1 for g in gains if g < 0) / len(gains):.0%}")
    print(f"   first->best mean {st.mean(f - b for f, b in zip(first, best)):.3f}; revised {revised} ({revised / n:.0%})")
    print(f"   cumulative pass by attempt: {[f'{x / n:.0%}' for x in by_k]}; served pass {sum(1 for p in served if p < 0.5) / n:.0%}, served mean {st.mean(served):.3f}")
    print(f"   wall ms/attempt median {st.median(r['ms'] / len(r['attempts']) for r in rows):.0f}; tokens in/out {tot_in}/{tot_out}; cost≈${tot_in * 0.3 / 1e6 + tot_out * 2.5 / 1e6:.3f}")


for p in sys.argv[1:]:
    analyse(p)
