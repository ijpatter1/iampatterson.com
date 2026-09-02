"""Per-source breakdown of the registry scores (scores CSV from
score-registry.ts) plus compression ratio from the runner reports.
Usage: python3 score-breakdown.py scores.csv pool.json reportA.json reportB.json
"""
import csv
import json
import sys
from collections import defaultdict

SHIPPED = 'r7d-mask-letme04'
rows = list(csv.DictReader(open(sys.argv[1])))
pool = {r['id']: r for r in json.load(open(sys.argv[2]))}
reports = [json.load(open(f)) for f in sys.argv[3:]]
variants = [r['modelId'] for r in reports]
out_len = {(r['modelId'], row['id']): len(row['out']) for r in reports for row in r['cl2en']}
attempts = {(r['modelId'], row['id']): len(row['attempts']) for r in reports for row in r['cl2en']}


def src_of(cid):
    return cid.split(':')[0]


def mean(xs):
    return sum(xs) / len(xs) if xs else float('nan')


by = defaultdict(lambda: defaultdict(list))
for r in rows:
    by[(src_of(r['id']), r['variant'])]['p'].append(float(r[SHIPPED]))
    by[(src_of(r['id']), r['variant'])]['product'].append(float(r['product']))
    by[(src_of(r['id']), r['variant'])]['heur'].append(float(r['heuristic']))

sources = sorted({src_of(r['id']) for r in rows})
print(f"shipped model {SHIPPED}: mean p | pass<0.5 share | mean product(max with heuristic)   (n)")
for src in sources + ['ALL']:
    print(f"-- {src}")
    for v in ['input'] + variants:
        if src == 'ALL':
            ps = [x for s in sources for x in by[(s, v)]['p']]
            pr = [x for s in sources for x in by[(s, v)]['product']]
        else:
            ps, pr = by[(src, v)]['p'], by[(src, v)]['product']
        if not ps:
            continue
        share = sum(1 for x in ps if x < 0.5) / len(ps)
        print(f"   {v.replace('gemini-', ''):<18} {mean(ps):.3f} | {share * 100:5.1f}% | {mean(pr):.3f}   (n={len(ps)})")

if len(variants) == 2:
    a, b = variants
    print(f"\npaired on {SHIPPED}, by source ({a.replace('gemini-', '')} lower / {b.replace('gemini-', '')} lower / ties<0.02):")
    pa = {r['id']: float(r[SHIPPED]) for r in rows if r['variant'] == a}
    pb = {r['id']: float(r[SHIPPED]) for r in rows if r['variant'] == b}
    for src in sources + ['ALL']:
        ids = [i for i in pa if i in pb and (src == 'ALL' or src_of(i) == src)]
        al = sum(1 for i in ids if pa[i] < pb[i] - 0.02)
        bl = sum(1 for i in ids if pb[i] < pa[i] - 0.02)
        print(f"   {src:<10} {al:3d} / {bl:3d} / {len(ids) - al - bl:3d}   mean diff (b-a) {mean([pb[i] - pa[i] for i in ids]):+.3f}")

print("\ncompression: mean(out chars / in chars), mean attempts")
for v in variants:
    ratios = [out_len[(v, i)] / len(pool[i]['text']) for i in pool if (v, i) in out_len and out_len[(v, i)] > 0]
    att = [attempts[(v, i)] for i in pool if (v, i) in attempts]
    print(f"   {v.replace('gemini-', ''):<18} ratio {mean(ratios):.2f}   attempts {mean(att):.2f}   empty outputs {sum(1 for i in pool if (v, i) in out_len and out_len[(v, i)] == 0)}")
