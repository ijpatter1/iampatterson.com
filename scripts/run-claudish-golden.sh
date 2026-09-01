#!/bin/bash
# Claudish translator — golden-set runner (feat/claudish).
#
# LIVE-API suite: runs the property-asserted golden fixtures through the
# real lane ladder. Costs ~$0.03/run at Haiku rates. Pre-deploy operator
# gate (no CI runs Jest in this repo today; WIF pending from Phase 11 D9).
#
# Requires: gcloud ADC with aiplatform access (Vertex lanes). The
# anthropic-api lane authenticates via WIF from the Cloud Run metadata
# server and is NOT exercisable locally — it's covered by the deploy
# smoke test instead.
# Usage: bash scripts/run-claudish-golden.sh
set -euo pipefail
cd "$(dirname "$0")/../infrastructure/cloud-run/claudish-proxy"
[ -d node_modules ] || npm install
GOLDEN_TEST=1 npx jest src/golden.test.ts --verbose
