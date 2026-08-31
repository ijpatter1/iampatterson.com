#!/bin/bash
# Claudish translator — golden-set runner (feat/claudish).
#
# LIVE-API suite: runs the property-asserted golden fixtures through the
# real lane ladder. Costs ~$0.03/run at Haiku rates. Pre-deploy operator
# gate (no CI runs Jest in this repo today; WIF pending from Phase 11 D9).
#
# Requires: gcloud ADC with aiplatform access (Vertex lanes), and/or
# ANTHROPIC_API_KEY exported (anthropic-api lane).
# Usage: bash scripts/run-claudish-golden.sh
set -euo pipefail
cd "$(dirname "$0")/../infrastructure/cloud-run/claudish-proxy"
[ -d node_modules ] || npm install
GOLDEN_TEST=1 npx jest src/golden.test.ts --verbose
