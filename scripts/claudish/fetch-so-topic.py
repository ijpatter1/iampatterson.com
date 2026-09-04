#!/usr/bin/env python3
"""Topic-matched human negatives: Stack Overflow questions and answers on the
tags the Claude transcripts are about (analytics engineering + the web stack),
created AND last edited on or before the ChatGPT-release cutoff, so every
block is human by construction. Bodies are HTML: code blocks, inline code,
links and tags are stripped; 200-2500 chars kept.
Usage: fetch-so-topic.py <out.txt> [per_tag_cap]
Loop-2 D1c (2026-09-02). Local corpus only; nothing here enters the repo."""
import html, json, re, sys, time, urllib.request, urllib.parse
out_path = sys.argv[1]; per_tag = int(sys.argv[2]) if len(sys.argv) > 2 else 400
CUTOFF = 1669852799  # 2022-11-30T23:59:59Z
FROM = 1546300800    # 2019-01-01
TAGS = ['google-tag-manager', 'google-analytics', 'google-analytics-4', 'google-bigquery', 'google-cloud-run',
        'terraform', 'next.js', 'reactjs', 'typescript', 'playwright', 'jestjs', 'tailwind-css', 'node.js',
        'google-cloud-platform', 'dbt', 'looker']
API = 'https://api.stackexchange.com/2.3'
def get(path, **params):
    q = urllib.parse.urlencode({**params, 'site': 'stackoverflow', 'filter': 'withbody', 'pagesize': 100})
    req = urllib.request.Request(f'{API}{path}?{q}', headers={'Accept-Encoding': 'gzip', 'User-Agent': 'claudish-corpus/loop2'})
    import gzip
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read(); data = json.loads(gzip.decompress(raw) if r.headers.get('Content-Encoding') == 'gzip' else raw)
    if data.get('backoff'): time.sleep(int(data['backoff']) + 1)
    return data
def clean(body):
    body = re.sub(r'<pre>.*?</pre>', ' ', body, flags=re.S)
    body = re.sub(r'<code>.*?</code>', ' ', body, flags=re.S)
    body = re.sub(r'<blockquote>.*?</blockquote>', ' ', body, flags=re.S)
    body = re.sub(r'<[^>]+>', ' ', body)
    body = html.unescape(body)
    body = re.sub(r'https?://\S+', ' ', body)
    return re.sub(r'\s+', ' ', body).strip()
def pre_cutoff(p):
    return p.get('creation_date', 9e9) <= CUTOFF and p.get('last_edit_date', 0) <= CUTOFF
kept = 0; quota = None
with open(out_path, 'w', encoding='utf-8', buffering=1) as o:
    for tag in TAGS:
        n = 0; page = 1; qids = []
        while n < per_tag and page <= 3:
            d = get('/questions', order='desc', sort='votes', tagged=tag, fromdate=FROM, todate=CUTOFF, page=page)
            quota = d.get('quota_remaining')
            for q in d.get('items', []):
                if not pre_cutoff(q): continue
                body = clean(q.get('body') or '')
                if 200 <= len(body) <= 2500:
                    o.write(body + '\n\n'); n += 1
                if q.get('answer_count', 0) > 0: qids.append(q['question_id'])
            if not d.get('has_more'): break
            page += 1; time.sleep(0.3)
        for i in range(0, len(qids), 100):
            if n >= per_tag: break
            ids = ';'.join(str(x) for x in qids[i:i + 100])
            d = get(f'/questions/{ids}/answers', order='desc', sort='votes')
            quota = d.get('quota_remaining')
            for a in d.get('items', []):
                if not pre_cutoff(a): continue
                body = clean(a.get('body') or '')
                if 200 <= len(body) <= 2500:
                    o.write(body + '\n\n'); n += 1
                    if n >= per_tag: break
            time.sleep(0.3)
        print(f'{tag}: {n} (quota {quota})', flush=True); kept += n
print('total blocks kept:', kept, flush=True)
