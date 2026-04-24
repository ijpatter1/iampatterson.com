#!/usr/bin/env bash
# Capture Core Web Vitals / Lighthouse baseline against a local production
# server. Phase 10b D1b's measurement script.
#
# Runs Lighthouse synthetic audits against the three dynamic routes that
# matter for Phase 10b: `/`, `/demo/ecommerce`, `/demo/ecommerce/confirmation`.
# Output: JSON + HTML reports in `docs/perf/lighthouse-<date>-<route>.{json,html}`.
# The numbers get folded into `docs/perf/baseline-<date>.md` manually — this
# script is the capture, not the docs update.
#
# Usage:
#   bash scripts/capture-cwv-baseline.sh              # uses today's date
#   DATE=2026-05-01 bash scripts/capture-cwv-baseline.sh    # override date
#   PORT=3200 bash scripts/capture-cwv-baseline.sh    # avoid port conflicts
#
# Assumes:
#   - `npm run build` has already landed a fresh .next/ directory
#   - No other process is holding the chosen port
#   - lighthouse is installed (npm install --save-dev lighthouse)
#
# Known quirks:
#   - `/demo/ecommerce`'s `after()` hook fires a fetch to bi.iampatterson.com
#     that trips Lighthouse's trace_engine insight computation. Perf score
#     will show as 0 for that route; FCP + CLS + Speed Index still captured.
#     The same after-response warmup is fine for real users; it's only the
#     synthetic trace-engine that falls over.

set -euo pipefail

PORT="${PORT:-3100}"
DATE="${DATE:-$(date +%Y-%m-%d)}"
OUT_DIR="docs/perf"
BASE_URL="http://localhost:${PORT}"

mkdir -p "$OUT_DIR"

echo "== Starting production server on :${PORT} =="
PORT="$PORT" npm run start > /tmp/cwv-capture-server.log 2>&1 &
SERVER_PID=$!
trap 'echo "== Stopping server (pid=${SERVER_PID}) =="; kill "${SERVER_PID}" 2>/dev/null || true' EXIT

# Poll for readiness up to 60s
echo "== Waiting for server to become ready =="
for i in $(seq 1 60); do
  if curl -sf -o /dev/null "${BASE_URL}/"; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 1
done

if ! curl -sf -o /dev/null "${BASE_URL}/"; then
  echo "ERROR: Server did not become ready within 60s. Log:"
  cat /tmp/cwv-capture-server.log
  exit 1
fi

run_lighthouse() {
  local route_url="$1"
  local route_label="$2"
  local preset="$3"            # 'mobile' or 'desktop'
  local out_base="${OUT_DIR}/lighthouse-${DATE}-${preset}-${route_label}"
  echo "== Lighthouse (${preset}): ${route_label} (${route_url}) =="
  # Lighthouse default preset is mobile (360×640, Slow 4G, 4x CPU throttle).
  # Pass --preset=desktop explicitly for the desktop run (1350×940, no
  # throttling). Keeping both preserves the real-user distribution — most
  # visitors arrive on mobile, but the desktop number is the portfolio
  # number prospects will see.
  # trace_engine errors surface on stderr; non-fatal — JSON/HTML outputs still
  # land. Don't fail the whole script on a single route's trace_engine issue.
  local preset_flag=""
  if [ "${preset}" = "desktop" ]; then preset_flag="--preset=desktop"; fi
  npx lighthouse "${route_url}" ${preset_flag} \
    --output=json --output=html \
    --output-path="${out_base}" \
    --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage" \
    --quiet || echo "(route ${route_label} [${preset}] had a non-fatal issue — check ${out_base}.report.json)"
}

for preset in mobile desktop; do
  run_lighthouse "${BASE_URL}/" home "${preset}"
  run_lighthouse "${BASE_URL}/demo/ecommerce" ecommerce "${preset}"
  run_lighthouse "${BASE_URL}/demo/ecommerce/confirmation?order_id=BASELINE-10b&total=44.98&items=2" confirmation "${preset}"
done

echo "== Summary =="
node --input-type=module -e "
import fs from 'node:fs';
const presets = ['mobile','desktop'];
const routes = ['home','ecommerce','confirmation'];
const audits = ['largest-contentful-paint','cumulative-layout-shift','total-blocking-time','first-contentful-paint','speed-index','interactive'];
for (const p of presets) {
  console.log(\`\n=== \${p.toUpperCase()} preset ===\`);
  for (const r of routes) {
    const f = \`${OUT_DIR}/lighthouse-${DATE}-\${p}-\${r}.report.json\`;
    if (!fs.existsSync(f)) { console.log(\`## \${r}: no report\`); continue; }
    const rep = JSON.parse(fs.readFileSync(f, 'utf8'));
    const c = rep.categories;
    console.log(\`## \${r}\`);
    console.log('  perf', Math.round((c.performance?.score ?? 0)*100), '| a11y', Math.round((c.accessibility?.score ?? 0)*100), '| bp', Math.round((c['best-practices']?.score ?? 0)*100), '| seo', Math.round((c.seo?.score ?? 0)*100));
    for (const k of audits) {
      const a = rep.audits[k];
      if (!a) continue;
      console.log('   ', k + ':', a.displayValue ?? a.numericValue);
    }
  }
}
"

echo
echo "Reports written under ${OUT_DIR}/lighthouse-${DATE}-*.{json,html}"
echo "Fold numbers into ${OUT_DIR}/baseline-${DATE}.md manually."
