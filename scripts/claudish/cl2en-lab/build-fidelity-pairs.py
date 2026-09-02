"""Side-by-side of cl2en outputs across prompt variants for a human read.
Usage: python3 build-fidelity-pairs.py out.md pool.json baseline.json A.json B.json
Picks the six battery inputs plus a stratified sample of round-trip and
holdout inputs (seeded), and prints input then each variant's output.
"""
import json
import random
import sys

out_path, pool_path = sys.argv[1], sys.argv[2]
reports = [json.load(open(f)) for f in sys.argv[3:]]
labels = ['baseline (deployed)', 'A (principle)', 'B (principle + procedure)'][: len(reports)]
pool = json.load(open(pool_path))
by = [{r['id']: r for r in rep['cl2en']} for rep in reports]
random.seed(7)
battery = [p for p in pool if p['src'] == 'battery']
rt = random.sample([p for p in pool if p['src'] == 'roundtrip'], 4)
ho = random.sample([p for p in pool if p['src'] == 'holdout'], 4)
golden = random.sample([p for p in pool if p['src'] == 'golden'], 2)
picked = battery + golden + rt + ho
lines = ['# cl2en fidelity encoding: baseline vs A vs B', '',
         'Served judge score in brackets (pass < 0.5). Same inputs, same model (3.5 Flash-Lite), same re-tuned loop; only the system prompt differs.', '']
for p in picked:
    lines += [f"## {p['id']}", '', '**Input (Claudish)**', '', p['text'], '']
    for label, b in zip(labels, by):
        r = b.get(p['id'])
        if not r:
            continue
        lines += [f"**{label}** [{r['p']:.3f}, {len(r['attempts'])} attempt(s)]", '', r['out'], '']
open(out_path, 'w').write('\n'.join(lines))
print('written', out_path, 'cases:', len(picked))
