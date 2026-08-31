#!/bin/bash
# Claudish translator — latency harness runner (feat/claudish).
#
# Measures TTFT p50/p95 against the spec targets (p50<1s, p95<2s, full
# render p95<3s under 300 chars) over 40 live calls (~$0.10/run).
# Against the DEPLOYED service when CLAUDISH_PROXY_URL is set (the
# number that matters), else an in-process server with real lanes.
# Commit the [latency] output line to docs/perf/claudish-latency-YYYY-MM-DD.md.
# Usage: [CLAUDISH_PROXY_URL=https://...] bash scripts/run-claudish-latency.sh
set -euo pipefail
cd "$(dirname "$0")/../infrastructure/cloud-run/claudish-proxy"
[ -d node_modules ] || npm install
LATENCY_TEST=1 npx jest src/latency.test.ts --verbose
