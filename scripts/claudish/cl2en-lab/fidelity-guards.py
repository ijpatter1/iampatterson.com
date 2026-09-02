"""Over-deletion guards for cl2en variants: the content-vs-register rule
must not eat the speaker's act. Per output: first person survives when
the input has it, a question stays a question, identifiers and numbers
survive, and the compression ratio distribution is reported (very short
outputs are flagged for a human read, not failed).
Usage: python3 fidelity-guards.py pool.json report.json [report.json ...]
"""
import json
import re
import sys
from statistics import mean, median

pool = {r['id']: r['text'] for r in json.load(open(sys.argv[1]))}
FIRST = re.compile(r"\b(I|I'm|I'll|I've|I'd|me|my|we|we're|we'll|we've|our|us)\b")
IDENT = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*(?:[._][A-Za-z0-9_]+|\(\))+\b|\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[A-Z]{2,}[A-Z0-9_]*\b")
NUM = re.compile(r"\b\d+(?:[.,]\d+)?%?\b")


def guards(inp: str, out: str):
    flags = []
    if FIRST.search(inp) and not FIRST.search(out):
        flags.append('first-person lost')
    if '?' in inp and '?' not in out:
        flags.append('question lost')
    missing_ids = [i for i in set(IDENT.findall(inp)) if i not in out]
    if missing_ids:
        flags.append(f'identifiers lost: {missing_ids[:3]}')
    missing_nums = [n for n in set(NUM.findall(inp)) if n not in out]
    if missing_nums:
        flags.append(f'numbers lost: {missing_nums[:3]}')
    if not out.strip():
        flags.append('EMPTY')
    return flags


for f in sys.argv[2:]:
    d = json.load(open(f))
    rows = d['cl2en']
    ratios = [len(r['out']) / len(pool[r['id']]) for r in rows if r['id'] in pool]
    flagged = [(r['id'], guards(pool[r['id']], r['out'])) for r in rows if r['id'] in pool]
    flagged = [(i, fl) for i, fl in flagged if fl]
    kinds = {}
    for _, fl in flagged:
        for x in fl:
            kinds[x.split(':')[0]] = kinds.get(x.split(':')[0], 0) + 1
    short = [r['id'] for r in rows if r['id'] in pool and len(r['out']) / len(pool[r['id']]) < 0.35]
    print(f"== {f.split('/')[-1]}: n={len(rows)}")
    print(f"   compression out/in: mean {mean(ratios):.2f} median {median(ratios):.2f} min {min(ratios):.2f}; outputs under 0.35x: {len(short)} {short[:6]}")
    print(f"   guard flags: {kinds if kinds else 'none'}")
    for i, fl in flagged[:8]:
        print(f"     {i}: {'; '.join(fl)}")
