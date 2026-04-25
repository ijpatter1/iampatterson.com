#!/usr/bin/env bash
# Phase 10d D1, mobile-matrix capture utility.
#
# Stands up a local dev server, runs the Playwright `matrix-*` projects
# against `tests/e2e/mobile-matrix.spec.ts`, and writes screenshots to
# `docs/perf/mobile-matrix-screenshots/<date>/`. Mirrors the shape of
# `scripts/capture-cwv-baseline.sh`: a developer utility, not a CI gate.
#
# Usage:
#   bash scripts/capture-mobile-matrix.sh                       # today's date
#   DATE=2026-05-01 bash scripts/capture-mobile-matrix.sh       # override
#   PORT=3200 bash scripts/capture-mobile-matrix.sh             # avoid conflicts
#   PROJECT=matrix-iphone-se bash scripts/capture-mobile-matrix.sh   # one device
#
# Assumes:
#   - `npm install` has been run
#   - `npx playwright install` has installed the chromium/webkit browsers
#   - The chosen port is free
#
# The findings get folded into `docs/perf/mobile-matrix-<date>.md` manually
# — this script is the capture step.

set -euo pipefail

PORT="${PORT:-3300}"
DATE="${DATE:-$(date +%Y-%m-%d)}"
PROJECT_FILTER="${PROJECT:-matrix-}"
OUT_DIR="docs/perf/mobile-matrix-screenshots/${DATE}"

mkdir -p "$OUT_DIR"

echo "== Building production bundle =="
npm run build > /tmp/mobile-matrix-build.log 2>&1 || {
  echo "ERROR: build failed. Tail of /tmp/mobile-matrix-build.log:"
  tail -30 /tmp/mobile-matrix-build.log
  exit 1
}

echo "== Starting production server on :${PORT} =="
PORT="$PORT" npm run start > /tmp/mobile-matrix-server.log 2>&1 &
SERVER_PID=$!
trap 'echo "== Stopping server (pid=${SERVER_PID}) =="; kill "${SERVER_PID}" 2>/dev/null || true' EXIT

# Poll for readiness up to 60s
echo "== Waiting for server to become ready =="
for i in $(seq 1 60); do
  if curl -sf -o /dev/null "http://localhost:${PORT}/"; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 1
done

if ! curl -sf -o /dev/null "http://localhost:${PORT}/"; then
  echo "ERROR: Server did not become ready within 60s. Tail of /tmp/mobile-matrix-server.log:"
  tail -30 /tmp/mobile-matrix-server.log
  exit 1
fi

echo "== Running mobile-matrix spec =="
echo "   PROJECT_FILTER=${PROJECT_FILTER}"
echo "   DATE=${DATE}"
echo "   Screenshot dir: ${OUT_DIR}"

E2E_ENABLED=1 \
MATRIX_DATE="${DATE}" \
PLAYWRIGHT_BASE_URL="http://localhost:${PORT}" \
  npx playwright test tests/e2e/mobile-matrix.spec.ts \
    --grep-invert='@desktop' \
    --reporter=list \
    --project="${PROJECT_FILTER}iphone-se" \
    --project="${PROJECT_FILTER}iphone-13" \
    --project="${PROJECT_FILTER}pixel-5" \
    --project="${PROJECT_FILTER}ipad-mini-portrait" \
    --project="${PROJECT_FILTER}ipad-mini-landscape" \
  || echo "(matrix completed with at least one assertion failure — check ${OUT_DIR} + the HTML report)"

echo
echo "== Summary =="
SHOT_COUNT=$(find "$OUT_DIR" -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
echo "Screenshots written: ${SHOT_COUNT}"
echo "Output dir: ${OUT_DIR}"
echo
echo "Fold findings into docs/perf/mobile-matrix-${DATE}.md manually."
echo "Open the HTML report with: npx playwright show-report"
