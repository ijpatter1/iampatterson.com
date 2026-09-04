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
# Usage: scripts/verify-node24.sh            (needs gcloud + a linked vercel CLI)
# Env:   PROJECT (iampatterson), REGION (us-central1), OUT (record path)
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

# 3. Newest Vercel build log
PREVIEW=$(npx vercel@latest ls --environment=preview 2>/dev/null | grep -oE "https://iampatterson-[a-z0-9]+-ian-pattersons-projects-[a-z0-9]+\.vercel\.app" | head -1)
if [ -n "$PREVIEW" ]; then
  LOG=$(npx vercel@latest inspect "$PREVIEW" --logs 2>&1)   # the CLI writes the log lines to stderr
  DEP=$(printf '%s' "$LOG" | grep -c "Node.js version 20.x is deprecated")
  DONE=$(printf '%s' "$LOG" | grep -c "Build Completed")
  [ "$DEP" = "0" ] && [ "$DONE" -ge 1 ]; check "Vercel build log without the Node 20 deprecation warning" $? "$PREVIEW: $DEP warning(s), build completed=$DONE$(printf '%s' "$LOG" | grep -o 'Node.js version changed from "[^"]*" to "[^"]*"' | head -1 | sed 's/^/, /')"
else
  check "Vercel build log without the Node 20 deprecation warning" 1 "no preview deployment found (vercel CLI not linked?)"
fi

# 4. Cloud Build logs behind the serving revisions
for s in event-stream data-generator claudish-proxy; do
  REV=$(gcloud run services describe "$s" --project="$PROJECT" --region="$REGION" --format='value(status.traffic[0].revisionName)' 2>/dev/null)
  IMG=$(gcloud run revisions describe "$REV" --project="$PROJECT" --region="$REGION" --format='value(spec.containers[0].image)' 2>/dev/null)
  BID=$(gcloud builds list --project="$PROJECT" --region="$REGION" --limit=12 --format='value(id,images)' 2>/dev/null | grep -F "${IMG%%@*}" | head -1 | awk '{print $1}')
  if [ -n "$BID" ]; then
    n=$(gcloud builds log "$BID" --project="$PROJECT" --region="$REGION" 2>/dev/null | grep -c 'node:24-slim'); [ "$n" -ge 1 ]; check "$s serving revision built from node:24-slim" $? "$REV, build $BID, $n log line(s)"
  else
    check "$s serving revision built from node:24-slim" 1 "$REV: no Cloud Build found for its image"
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
SMOKE=$(python3 - <<'PYEOF'
import json, urllib.request, time
url = "https://claudish-proxy-eb4xrwmo3q-uc.a.run.app/translate"
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
