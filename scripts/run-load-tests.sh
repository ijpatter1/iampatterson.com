#!/usr/bin/env bash
# Phase 10d D6 — synthetic load-test runner.
#
# Drives both gated load-test suites (event-stream service + data-generator)
# and prints a human-readable summary to stdout. Re-run before/after a
# perf-affecting change to compare the throughput delta against the
# committed baseline in docs/perf/load-test-2026-04-25.md.
#
# Pre-reqs: `npm install` already run inside both service directories.
# Without that, the load tests fail at TypeScript module resolution
# rather than at runtime. The runner installs deps automatically if
# the service dir's `node_modules/` is missing — convenient for
# developer machines, but means a CI invocation will silently
# network-install dependencies. Use a CI workflow that pre-installs
# both service dirs before calling this script if that's a concern.
#
# Usage:
#   ./scripts/run-load-tests.sh
#
# Exit code:
#   0 — both suites passed (every assertion green)
#   1 — at least one suite failed
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "============================================================"
echo "Phase 10d D6 — synthetic load test runner"
echo "  Run from: $REPO_ROOT"
echo "  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================"
echo

echo "[1/2] event-stream service (Pub/Sub parse + ConnectionManager routing)"
echo "------------------------------------------------------------"
(
  cd "$REPO_ROOT/infrastructure/cloud-run/event-stream"
  if [ ! -d node_modules ]; then
    echo "  → installing service deps (one-time)..."
    npm install --silent
  fi
  LOAD_TEST=1 npx jest src/load.test.ts
)
echo

echo "[2/2] data-generator service (event generation throughput)"
echo "------------------------------------------------------------"
(
  cd "$REPO_ROOT/infrastructure/cloud-run/data-generator"
  if [ ! -d node_modules ]; then
    echo "  → installing service deps (one-time)..."
    npm install --silent
  fi
  LOAD_TEST=1 npx jest src/load.test.ts
)
echo

echo "============================================================"
echo "Done. See docs/perf/load-test-2026-04-25.md for committed baseline."
echo "============================================================"
