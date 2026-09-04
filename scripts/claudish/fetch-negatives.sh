#!/bin/bash
# Claudish CCLD — negative-corpus fetcher (feat/claudish M5).
#
# Hard cutoff: every source is human writing authored on or before
# 2022-11-30 (pre-ChatGPT), pinned by commit date where git history
# provides it. Personal-corpus sources were declined (user decision);
# mix: wikitext (formal encyclopedic prose — the sharpest "careful
# human with em dashes" negatives), pre-2023 OSS docs (technical
# register), HN comments via BigQuery when authed, plus filtered human
# turns extracted from the transcripts by extract-human-turns.ts.
# Everything lands OUTSIDE the repo in ~/.claudish-corpus/negatives/.
#
# Usage: bash scripts/claudish/fetch-negatives.sh
set -euo pipefail
OUT="${OUT:-$HOME/.claudish-corpus/negatives}"
SRC="${SRC:-$HOME/.claudish-corpus/negatives-src}"
CUTOFF="2022-11-30"
mkdir -p "$OUT" "$SRC"
MANIFEST="$OUT/manifest.json"
echo '{"cutoff":"'$CUTOFF'","fetchedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","sources":[' > "$MANIFEST.tmp"

fetch_repo_docs() {
  local name="$1" url="$2" subdir="$3" glob="$4"
  echo "── $name ──"
  if [ ! -d "$SRC/$name/.git" ]; then
    git clone --quiet --shallow-since=2022-01-01 --no-checkout "$url" "$SRC/$name" || {
      echo "  ⚠ clone failed, skipping $name"; return 0; }
  fi
  local sha
  sha=$(git -C "$SRC/$name" rev-list -1 --before="$CUTOFF 23:59" origin/HEAD 2>/dev/null || \
        git -C "$SRC/$name" rev-list -1 --before="$CUTOFF 23:59" HEAD 2>/dev/null || true)
  if [ -z "$sha" ]; then echo "  ⚠ no pre-cutoff commit reachable, skipping"; return 0; fi
  git -C "$SRC/$name" checkout --quiet "$sha" -- "$subdir" 2>/dev/null || \
    git -C "$SRC/$name" checkout --quiet "$sha"
  local outfile="$OUT/${name}.txt"
  : > "$outfile"
  find "$SRC/$name/$subdir" -name "$glob" -type f 2>/dev/null | head -400 | while read -r f; do
    cat "$f" >> "$outfile"; printf '\n\n' >> "$outfile"
  done
  local bytes
  bytes=$(wc -c < "$outfile" | tr -d ' ')
  echo "  $name @ ${sha:0:10} → $bytes bytes"
  echo '{"name":"'$name'","url":"'$url'","sha":"'$sha'","bytes":'$bytes'},' >> "$MANIFEST.tmp"
}

echo "── wikipedia-2022 (formal prose, pre-cutoff revisions) ──"
if [ ! -s "$OUT/wikipedia-2022.txt" ]; then
  python3 "$(dirname "$0")/fetch-wikipedia-2022.py" "$OUT/wikipedia-2022.txt" || \
    echo "  ⚠ wikipedia fetch failed — proceeding without"
else
  echo "  already present ($(wc -c < "$OUT/wikipedia-2022.txt" | tr -d ' ') bytes)"
fi
[ -s "$OUT/wikipedia-2022.txt" ] && echo '{"name":"wikipedia-2022","url":"en.wikipedia.org API, revisions as of '"$CUTOFF"'","bytes":'$(wc -c < "$OUT/wikipedia-2022.txt" | tr -d ' ')'},'  >> "$MANIFEST.tmp"

fetch_repo_docs "rust-book" "https://github.com/rust-lang/book" "src" "*.md"
fetch_repo_docs "curl-docs" "https://github.com/curl/curl" "docs" "*.md"
fetch_repo_docs "git-docs" "https://github.com/git/git" "Documentation" "*.txt"

echo "── movie dialogs (conversational register, corpus dated 2011) ──"
if [ ! -s "$OUT/movie-dialogs.txt" ]; then
  # The conversational negative source: without it the model learns
  # workflow openers ('let me') as near-sufficient Claudish evidence.
  if curl -sfL --max-time 120 -o "$SRC/cornell.zip" \
      "https://www.cs.cornell.edu/~cristian/data/cornell_movie_dialogs_corpus.zip"; then
    (cd "$SRC" && unzip -oq cornell.zip)
    python3 - "$SRC" "$OUT/movie-dialogs.txt" <<'PYEXTRACT'
import io, random, re, sys
src, out = sys.argv[1], sys.argv[2]
lines = []
with io.open(f"{src}/cornell movie-dialogs corpus/movie_lines.txt", encoding="iso-8859-1") as f:
    for line in f:
        parts = line.split(" +++$+++ ")
        if len(parts) != 5: continue
        text = re.sub(r"<[^>]+>", " ", parts[4]).strip()
        text = re.sub(r"\s+", " ", text)
        if 20 <= len(text) <= 500 and re.search(r"[a-zA-Z]{3}", text):
            lines.append(text)
random.seed(1337); random.shuffle(lines)
io.open(out, "w", encoding="utf-8").write("\n\n".join(lines[:40000]) + "\n")
print(f"movie-dialogs: {min(40000,len(lines))} utterances")
PYEXTRACT
    echo '{"name":"movie-dialogs","url":"cs.cornell.edu cornell_movie_dialogs_corpus (2011)","bytes":'$(wc -c < "$OUT/movie-dialogs.txt" | tr -d ' ')'},'  >> "$MANIFEST.tmp"
  else
    echo "  ⚠ cornell download failed — proceeding without"
  fi
else
  echo "  already present"
fi

echo "── HN comments (pre-2022, via BigQuery public data) ──"
if [ ! -s "$OUT/hn.txt" ] && command -v bq >/dev/null 2>&1 && gcloud auth print-access-token >/dev/null 2>&1; then
  bq --project_id=iampatterson query --nouse_legacy_sql --format=csv --max_rows=20000 \
    "SELECT text FROM \`bigquery-public-data.hacker_news.full\` WHERE type='comment' AND timestamp < '2022-01-01' AND LENGTH(text) BETWEEN 200 AND 1200 AND RAND() < 0.001 LIMIT 20000" \
    2>/dev/null | python3 -c "
import csv, html, io, re, sys
rows = list(csv.reader(io.StringIO(sys.stdin.read())))[1:]
out = []
for row in rows:
    if not row: continue
    text = html.unescape(row[0]).replace('<p>', '\n').strip()
    text = re.sub(r'<[^>]+>', ' ', text)
    out.append(text)
print('\n\n'.join(out))" > "$OUT/hn.txt" || echo "  ⚠ bq query failed — proceeding without"
  [ -s "$OUT/hn.txt" ] && echo '{"name":"hn-pre2022","url":"bigquery-public-data.hacker_news.full","bytes":'$(wc -c < "$OUT/hn.txt" | tr -d ' ')'},' >> "$MANIFEST.tmp" && echo "  hn → $(wc -c < "$OUT/hn.txt" | tr -d ' ') bytes"
else
  echo "  skipped (present, or bq/auth unavailable)"
fi

echo '{"name":"_end"}]}' >> "$MANIFEST.tmp"
mv "$MANIFEST.tmp" "$MANIFEST"
echo "── done ──"
ls -la "$OUT"
