#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Verify the Node.js 24 runtime on every surface and write the record.
#
# Phase 12, deliverable 12.1. Every check here is one the acceptance names
# and one a machine can make: the repo pins, the local toolchain, the
# newest Vercel build log, the Cloud Build logs behind the three serving
# revisions, the health endpoints, and the proxy smoke in both directions.
# The result is written to docs/verification/ as the record; nothing here
# asks a person to look at a console.
#
# Usage: scripts/verify-node24.sh            (needs gcloud + a linked vercel CLI; runs the suites and the golden gate)
# Env:   PROJECT (iampatterson), REGION (us-central1), OUT (record path), VERCEL_ENV (preview|production),
#        DEPLOY_DIFFS ("svc:revA:revB ..." to record redeploy diffs), PREVIEW_PROVENANCE (free text)
# ═══════════════════════════════════════════════════════════════════════
set -uo pipefail
export PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:$PATH

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OUT="${OUT:-docs/verification/$(date -u +%Y-%m-%d)-node24-runtime.md}"
mkdir -p "$(dirname "$OUT")"

PASS=0; FAIL=0; ROWS=()
check() { # check <name> <ok:0|1> <detail>
  if [ "$2" = "0" ]; then PASS=$((PASS+1)); ROWS+=("| ✓ | $1 | $3 |"); else FAIL=$((FAIL+1)); ROWS+=("| ✗ | $1 | $3 |"); fi
}

# 1. Repo pins
ENG=$(python3 -c 'import json; print(json.load(open("package.json")).get("engines",{}).get("node",""))')
[ "$ENG" = "24.x" ]; check "package.json engines.node" $? "\`$ENG\`"
for s in event-stream data-generator claudish-proxy; do
  n=$(grep -c '^FROM node:24-slim' "infrastructure/cloud-run/$s/Dockerfile"); [ "$n" = "2" ]; check "$s Dockerfile stages on node:24-slim" $? "$n of 2 FROM lines"
done

# 2. Local toolchain
NV=$(node -v 2>/dev/null); [[ "$NV" == v24.* ]]; check "local node on the test PATH" $? "$NV"
WF=.github/workflows/sync-dataform.yml
[ -f "$WF" ] && ! grep -qE "setup-node|node-version" "$WF"; check "sync-dataform workflow pins no Node" $? "$( [ -f "$WF" ] && echo "no setup-node / node-version in the workflow" || echo "workflow file missing")"
for s in event-stream data-generator claudish-proxy; do
  TN=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("devDependencies",{}).get("@types/node",""))' "infrastructure/cloud-run/$s/package.json")
  # Compare the major number, not a glob. A [[ ]] equality test against a
  # caret-prefixed pattern is a literal-prefix match, not a regex, so it passed
  # "^24.13.3" and rejected "~24.13.3" or ">=24.0.0" (review finding).
  TMAJ=$(printf '%s' "$TN" | sed -E 's/^[^0-9]*//' | cut -d. -f1); [ "$TMAJ" = "24" ]; check "$s @types/node on major 24" $? "\`${TN:-absent}\`"
done

# 2b. Suites under this Node (the acceptance's first clause; slow, but the record must carry it)
# Exit codes decide; the summary lines are evidence. Jest reports a suite that fails to
# compile, or a throwing afterAll (the golden fall-through gate), as a failed SUITE with a
# clean Tests: line, so the grep alone would record a false green (review finding).
LOG=$(mktemp); npm test > "$LOG" 2>&1; RC=$?; ROOT=$(grep -E "^Tests:" "$LOG" | tail -1 | tr -s ' '); SUITES=$(grep -E "^Test Suites:" "$LOG" | tail -1 | tr -s ' '); rm -f "$LOG"
[ "$RC" -eq 0 ]; check "root suite green under $NV" $? "exit $RC; ${ROOT:-no summary line}; ${SUITES:-}"
for s in event-stream data-generator claudish-proxy; do
  LOG=$(mktemp); (cd "infrastructure/cloud-run/$s" && npm test > "$LOG" 2>&1); RC=$?; R=$(grep -E "^Tests:" "$LOG" | tail -1 | tr -s ' '); rm -f "$LOG"
  [ "$RC" -eq 0 ]; check "$s suite green under $NV" $? "exit $RC; ${R:-no summary line}"
done
LOG=$(mktemp); bash scripts/run-claudish-golden.sh > "$LOG" 2>&1; GRC=$?; GOLD=$(cat "$LOG"); rm -f "$LOG"; GSUM=$(printf '%s' "$GOLD" | grep -E "^Tests:" | tail -1 | tr -s ' '); GFT=$(printf '%s' "$GOLD" | grep -c "loop fell through pre-token")
GFAIL=$(printf '%s' "$GOLD" | grep -E "^ +(cl2en|en2cl)-[0-9]+-[a-z0-9-]+ violated:" | sed -E 's/^ *//; s/ violated: / — /' | tr '\n' ';' | sed 's/;$//')
[ "$GRC" -eq 0 ]; check "proxy golden gate green under $NV (served loop; fall-throughs counted)" $? "exit $GRC; ${GSUM:-no summary line}; $GFT case(s) fell through to the Claude lane${GFAIL:+; failed: $GFAIL}"

# 3. Newest Vercel build log
VERCEL_ENV="${VERCEL_ENV:-preview}"
PREVIEW=$(npx vercel@latest ls --environment="$VERCEL_ENV" 2>/dev/null | grep -oE "https://iampatterson-[a-z0-9]+-ian-pattersons-projects-[a-z0-9]+\.vercel\.app" | head -1)
if [ -n "$PREVIEW" ]; then
  LOG=$(npx vercel@latest inspect "$PREVIEW" --logs 2>&1)   # the CLI writes the log lines to stderr
  DEP=$(printf '%s' "$LOG" | grep -c "Node.js version 20.x is deprecated")
  DONE=$(printf '%s' "$LOG" | grep -c "Build Completed")
  RUNTIME=$(npx vercel@latest inspect "$PREVIEW" 2>&1 | grep -oiE "node(js)?[ =:]+[0-9]+\.x" | head -1)
  [ "$DEP" = "0" ] && [ "$DONE" -ge 1 ]; check "Vercel $VERCEL_ENV build log without the Node 20 deprecation warning" $? "$PREVIEW: $DEP warning(s), build completed=$DONE$(printf '%s' "$LOG" | grep -o 'Node.js version changed from "[^"]*" to "[^"]*"' | head -1 | sed 's/^/, /')${RUNTIME:+, runtime $RUNTIME}${PREVIEW_PROVENANCE:+; provenance: $PREVIEW_PROVENANCE}"
else
  check "Vercel build log without the Node 20 deprecation warning" 1 "no preview deployment found (vercel CLI not linked?)"
fi

# 4. Cloud Build logs behind the serving revisions
for s in event-stream data-generator claudish-proxy; do
  REV=$(gcloud run services describe "$s" --project="$PROJECT" --region="$REGION" --format=json 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); t=[x for x in d["status"].get("traffic",[]) if x.get("percent")]; print(t[0]["revisionName"] if t else "")')
  IMG=$(gcloud run revisions describe "$REV" --project="$PROJECT" --region="$REGION" --format='value(spec.containers[0].image)' 2>/dev/null)
  DIGEST="${IMG##*@}"
  BID=""
  # An empty digest would match every build (grep -F ""), so it is a failure, not a lookup.
  if [ -n "$REV" ] && [ -n "$IMG" ] && [ "$DIGEST" != "$IMG" ]; then
    BID=$(gcloud builds list --project="$PROJECT" --region="$REGION" --limit=30 --format='value(id,results.images[].digest)' 2>/dev/null | grep -F "$DIGEST" | head -1 | awk '{print $1}')
  fi
  if [ -n "$BID" ]; then
    n=$(gcloud builds log "$BID" --project="$PROJECT" --region="$REGION" 2>/dev/null | grep -c 'node:24-slim'); [ "$n" -ge 1 ]; check "$s serving revision built from node:24-slim" $? "$REV, build $BID (matched by image digest), $n log line(s)"
  else
    check "$s serving revision built from node:24-slim" 1 "${REV:-<no serving revision resolved>}: no Cloud Build matched the image digest"
  fi
done

# 5. Health endpoints (data-generator is private: identity token)
TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
for s in event-stream data-generator claudish-proxy; do
  U=$(gcloud run services describe "$s" --project="$PROJECT" --region="$REGION" --format='value(status.url)' 2>/dev/null)
  if [ "$s" = "data-generator" ]; then code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -H "Authorization: Bearer $TOKEN" "$U/health"); else code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$U/health"); fi
  [ "$code" = "200" ]; check "$s /health on the serving revision" $? "HTTP $code"
done

# 6. Proxy smoke, both directions, from the production origin (a per-run nonce keeps it off the cache)
PROXY_URL=$(gcloud run services describe claudish-proxy --project="$PROJECT" --region="$REGION" --format='value(status.url)' 2>/dev/null)
SMOKE=$(PROXY_URL="$PROXY_URL" python3 - <<'PYEOF'
import json, os, urllib.request, time
url = os.environ["PROXY_URL"] + "/translate"
res = []
nonce = time.strftime('%H%M%S')
for direction, text in [('cl2en', f"Run {nonce}. Two caveats I'll carry rather than bury. The cache made the echo look permanent, so the retry failing tells us little on its own; the missing token is the real signal."), ('en2cl', f'Run {nonce}. The build is fixed. I moved the flaky test to its own job.')]:
    try:
        req = urllib.request.Request(url, data=json.dumps({"text": text, "direction": direction}).encode(), headers={"Origin": "https://www.iampatterson.com", "Content-Type": "application/json"}, method="POST")
        t0 = time.time(); last = None; chars = 0
        with urllib.request.urlopen(req, timeout=60) as r:
            for raw in r:
                line = raw.decode().strip()
                if line.startswith('data:'):
                    f = json.loads(line[5:]); last = f['type']
                    if f['type'] == 'token': chars += len(f['t'])
        res.append(f"{direction}:{'ok' if last == 'done' and chars > 0 else 'FAIL'} ({chars} chars, {time.time()-t0:.1f}s, last frame {last})")
    except Exception as e:
        res.append(f"{direction}:FAIL ({type(e).__name__})")
print(' | '.join(res))
PYEOF
)
printf '%s' "$SMOKE" | grep -q "FAIL"; [ $? -ne 0 ]; check "claudish-proxy smoke in both directions" $? "$SMOKE"

# 6b. Redeploy diffs (DEPLOY_DIFFS="svc:before:after ..."): the field diff each promotion was reviewed on
for spec in ${DEPLOY_DIFFS:-}; do
  IFS=: read -r s a b <<< "$spec"
  out=$(DIFF_DIR=docs/verification/deploys bash scripts/deploy-cloud-run.sh diff "$s" "$a" "$b" 2>&1 | grep -E "differ|digest" | tr '\n' ' ')
  printf '%s' "$out" | grep -qE "(^| )0 field\(s\) differ besides the digest"; check "$s redeploy $a -> $b changed only the image digest" $? "$out (docs/verification/deploys/$b.diff)"
done

# 7. Record
{
  echo "# Node.js 24 runtime verification"
  echo
  echo "Deliverable 12.1. Generated by \`scripts/verify-node24.sh\` at $STAMP. Every row is a machine check; rerun the script to refresh."
  echo
  echo "| | Check | Evidence |"
  echo "|---|---|---|"
  printf '%s\n' "${ROWS[@]}"
  echo
  echo "Result: $PASS passed, $FAIL failed."
} > "$OUT"
echo "record: $OUT"; echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
