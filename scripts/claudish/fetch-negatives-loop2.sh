#!/bin/bash
# Claudish CCLD — loop-2 negative sources (docs/claudish/cl2en-loop2-plan.md, D1).
# Human-written, authored on or before 2022-11-30, chosen to resemble PLAIN prose about
# technical and business content (the register the shipped detector wrongly convicts).
# Everything lands OUTSIDE the repo in ~/.claudish-corpus/negatives/ with manifest-loop2.json.
# Usage: bash scripts/claudish/fetch-negatives-loop2.sh
set -uo pipefail
OUT="${OUT:-$HOME/.claudish-corpus/negatives}"; SRC="${SRC:-$HOME/.claudish-corpus/negatives-src}"
CUTOFF="2022-11-30"; mkdir -p "$OUT" "$SRC"
M="$OUT/manifest-loop2.json"; echo '{"cutoff":"'$CUTOFF'","fetchedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","sources":[' > "$M.tmp"
entry() { echo '{"name":"'$1'","url":"'$2'","pin":"'$3'","bytes":'$(wc -c < "$OUT/$1.txt" | tr -d ' ')'},' >> "$M.tmp"; }
fetch_repo_docs() {
  local name="$1" url="$2" subdir="$3" glob="$4"; echo "── $name ──"
  if [ ! -d "$SRC/$name/.git" ]; then git clone --quiet --shallow-since=2022-06-01 --no-checkout "$url" "$SRC/$name" || { echo "  clone failed, skipping"; return 0; }; fi
  local sha; sha=$(git -C "$SRC/$name" rev-list -1 --before="$CUTOFF 23:59" origin/HEAD 2>/dev/null || git -C "$SRC/$name" rev-list -1 --before="$CUTOFF 23:59" HEAD 2>/dev/null || true)
  [ -n "$sha" ] || { echo "  no pre-cutoff commit, skipping"; return 0; }
  git -C "$SRC/$name" checkout --quiet "$sha" -- "$subdir" 2>/dev/null || git -C "$SRC/$name" checkout --quiet "$sha"
  : > "$OUT/$name.txt"
  find "$SRC/$name/$subdir" -name "$glob" -type f 2>/dev/null | head -500 | while read -r f; do
    # strip front matter and the most common markdown/html syntax; keep prose
    python3 - "$f" <<'PY' >> "$OUT/$name.txt"
import re, sys
t = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
t = re.sub(r'^---.*?---\s*', '', t, count=1, flags=re.S)
t = re.sub(r'```.*?```', ' ', t, flags=re.S)
t = re.sub(r'<[^>]+>', ' ', t)
t = re.sub(r'\{\{[^}]*\}\}', ' ', t)
t = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', t)
t = re.sub(r'^\s*[#>*|-]+\s*', '', t, flags=re.M)
print(t.strip() + '\n')
PY
  done
  echo "  $name @ ${sha:0:10} -> $(wc -c < "$OUT/$name.txt" | tr -d ' ') bytes"; entry "$name" "$url" "$sha"
}
echo "── simple-wikipedia (plain-English encyclopedia, pre-cutoff revisions) ──"
if [ ! -s "$OUT/simple-wikipedia.txt" ]; then python3 "$(dirname "$0")/fetch-simple-wikipedia-2022.py" "$OUT/simple-wikipedia.txt" || echo "  simple wikipedia fetch failed"; fi
[ -s "$OUT/simple-wikipedia.txt" ] && entry simple-wikipedia "simple.wikipedia.org API, revisions as of $CUTOFF" "revisions<=$CUTOFF"
fetch_repo_docs "mdn-http" "https://github.com/mdn/content" "files/en-us/web/http" "*.md"
fetch_repo_docs "plainlanguage" "https://github.com/GSA/plainlanguage.gov" "_pages" "*.md"
echo "── enron-ham (human business email, 2001) ──"
if [ ! -s "$OUT/enron-ham.txt" ]; then
  if curl -sfL --max-time 300 -o "$SRC/enron_spam_data.zip" "https://github.com/MWiechmann/enron_spam_data/raw/master/enron_spam_data.zip"; then
    (cd "$SRC" && unzip -oq enron_spam_data.zip) && python3 - "$SRC" "$OUT/enron-ham.txt" <<'PY'
import csv, sys, re, glob
src, out = sys.argv[1], sys.argv[2]
files = glob.glob(f"{src}/enron_spam_data.csv") or glob.glob(f"{src}/**/enron_spam_data.csv", recursive=True)
csv.field_size_limit(10**8)
n = 0
with open(out, 'w', encoding='utf-8') as o, open(files[0], encoding='utf-8', errors='ignore') as f:
    for row in csv.DictReader(f):
        if row.get('Spam/Ham', '').strip().lower() != 'ham': continue
        body = re.sub(r'\s+', ' ', (row.get('Message') or '')).strip()
        if 200 <= len(body) <= 3000:
            o.write(body + '\n\n'); n += 1
        if n >= 6000: break
print('enron ham bodies:', n)
PY
  else echo "  enron download failed"; fi
fi
[ -s "$OUT/enron-ham.txt" ] && entry enron-ham "github.com/MWiechmann/enron_spam_data (Enron corpus, 2001)" "corpus-2001"
echo "── stackexchange answers (human technical + workplace prose, created <= cutoff) ──"
if [ ! -s "$OUT/stackexchange.txt" ]; then python3 - "$OUT/stackexchange.txt" <<'PY'
import gzip, json, re, sys, time, urllib.request, html
out = sys.argv[1]; todate = 1669766400  # 2022-11-30 00:00 UTC
n = 0
with open(out, 'w', encoding='utf-8') as o:
    for site, pages in (('stackoverflow', 12), ('workplace', 12), ('superuser', 6)):
        for page in range(1, pages + 1):
            url = f"https://api.stackexchange.com/2.3/answers?order=desc&sort=votes&site={site}&filter=withbody&todate={todate}&pagesize=100&page={page}"
            req = urllib.request.Request(url, headers={'Accept-Encoding': 'gzip', 'User-Agent': 'claudish-corpus/1.0'})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = json.loads(gzip.decompress(r.read()).decode('utf-8'))
            except Exception as e:
                print(f'  {site} page {page} failed: {e}'); break
            for a in data.get('items', []):
                if a.get('creation_date', 0) > todate: continue
                body = a.get('body', '')
                body = re.sub(r'<pre>.*?</pre>', ' ', body, flags=re.S)
                body = re.sub(r'<code>[^<]*</code>', ' ', body)
                body = html.unescape(re.sub(r'<[^>]+>', ' ', body))
                body = re.sub(r'\s+', ' ', body).strip()
                if 250 <= len(body) <= 2500:
                    o.write(body + '\n\n'); n += 1
            if data.get('quota_remaining', 1) < 5 or not data.get('has_more'): break
            time.sleep(0.4)
print('stackexchange answers:', n)
PY
fi
[ -s "$OUT/stackexchange.txt" ] && entry stackexchange "api.stackexchange.com answers (stackoverflow, workplace, superuser), creation_date <= $CUTOFF" "todate=$CUTOFF"
echo '{"name":"_end"}]}' >> "$M.tmp"; mv "$M.tmp" "$M"
echo "── done ──"; python3 -c "import json;print(json.dumps(json.load(open('$M')), indent=0)[:900])"
