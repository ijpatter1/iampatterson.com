#!/usr/bin/env python3
"""Loop-2 D1b negative source: HUMAN developer prose about code changes, the closest human
analogue to the transcript skeleton (identifiers, PR numbers, commit refs, status reports).
Issue and pull-request comments created on or before 2022-11-30 from long-lived open-source
repositories, fetched through `gh api` (authenticated rate limit). Bots and obvious templates
are dropped; code blocks and quotes are stripped. Output: one comment per block.
Usage: python3 fetch-github-comments.py <out.txt> [max_per_repo]"""
import json, re, subprocess, sys, time
out_path = sys.argv[1]; per_repo = int(sys.argv[2]) if len(sys.argv) > 2 else 700
REPOS = ['rust-lang/rust', 'git/git', 'curl/curl', 'golang/go', 'kubernetes/kubernetes', 'nodejs/node', 'python/cpython', 'rails/rails', 'django/django', 'microsoft/TypeScript']
CUTOFF = '2022-11-30T23:59:59Z'
BOT = re.compile(r'\[bot\]$|^(dependabot|renovate|codecov|github-actions|bors|rustbot|golangbot|gopherbot|k8s-ci-robot|fejta-bot|nodejs-github-bot|bedevere|miss-islington|the-knights-who-say-ni)', re.I)
def clean(body):
    body = re.sub(r'```.*?```', ' ', body, flags=re.S)
    body = re.sub(r'`[^`]*`', ' ', body)
    body = re.sub(r'^>.*$', ' ', body, flags=re.M)
    body = re.sub(r'<!--.*?-->', ' ', body, flags=re.S)
    body = re.sub(r'<[^>]+>', ' ', body)
    body = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', body)
    body = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', body)
    body = re.sub(r'\s+', ' ', body).strip()
    return body
kept = 0
with open(out_path, 'w', encoding='utf-8', buffering=1) as o:
    for repo in REPOS:
        n = 0; page = 1
        while n < per_repo and page <= 40:
            url = f"repos/{repo}/issues/comments?sort=created&direction=asc&per_page=100&page={page}&since=2021-06-01T00:00:00Z"
            # walk FORWARD from mid-2021 so the first page is already pre-cutoff; stop at the first post-cutoff comment.
            # (The first version walked newest-first from 2026 and never reached the cutoff on busy repos.)
            r = subprocess.run(['gh', 'api', url], capture_output=True, text=True)
            if r.returncode != 0:
                print(f'  {repo} page {page}: {r.stderr.strip()[:80]}', flush=True); break
            items = json.loads(r.stdout)
            if not items: break
            hit_cutoff = False
            for c in items:
                if c.get('created_at', '9') > CUTOFF: hit_cutoff = True; break
                user = (c.get('user') or {}).get('login', '')
                if BOT.search(user): continue
                body = clean(c.get('body') or '')
                if 200 <= len(body) <= 2500 and not body.lower().startswith(('lgtm', 'ping', 'cc ')):
                    o.write(body + '\n\n'); n += 1
                    if n >= per_repo: break
            if hit_cutoff: break
            page += 1; time.sleep(0.2)
        print(f'{repo}: {n} (pages {page})', flush=True); kept += n
print('total comments kept:', kept, flush=True)
