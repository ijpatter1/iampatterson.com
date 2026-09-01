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
# Usage: bash scripts/run-claudish-golden.sh [jest args, e.g. -t en2cl-16]
set -euo pipefail
cd "$(dirname "$0")/../infrastructure/cloud-run/claudish-proxy"
[ -d node_modules ] || npm install

# Anthropic lane via WIF from a dev machine: mint an impersonated
# identity token to a file (no metadata server off-GCP). Requires
# roles/iam.serviceAccountTokenCreator on the SA. Ids are identifiers,
# not secrets; the minted JWT lives in a private tmp file for ~1h.
WIF_TOKEN_FILE="$(mktemp)"
trap 'rm -f "${WIF_TOKEN_FILE}"' EXIT
gcloud auth print-identity-token \
  --impersonate-service-account=claudish-proxy@iampatterson.iam.gserviceaccount.com \
  --audiences=https://api.anthropic.com \
  --include-email 2>/dev/null > "${WIF_TOKEN_FILE}"

# cl2en runs the DEPLOYED engine — the judge-driven Gemini loop — not the
# Claude ladder (the config default). Before 2026-09-01 this runner left
# CL2EN_ENGINE unset, so its cl2en cases exercised a path that does not
# serve traffic. The Gemini adapter's dev seam is GEMINI_ACCESS_TOKEN; an
# access token for the service's own runtime account mirrors production
# identity and carries its quota project. Token lives only in this
# process's environment (never argv, never echoed).
GEMINI_ACCESS_TOKEN="$(gcloud auth print-access-token \
  --impersonate-service-account=claudish-proxy@iampatterson.iam.gserviceaccount.com 2>/dev/null)"
export GEMINI_ACCESS_TOKEN

GOLDEN_TEST=1 \
  LANES="${LANES:-anthropic-api,cache-only}" \
  CL2EN_ENGINE="${CL2EN_ENGINE:-gemini-loop}" \
  GCP_PROJECT="${GCP_PROJECT:-iampatterson}" \
  GEMINI_MODEL_ID="${GEMINI_MODEL_ID:-gemini-2.5-flash}" \
  GEMINI_LOCATION="${GEMINI_LOCATION:-us-central1}" \
  ANTHROPIC_FEDERATION_RULE_ID="${ANTHROPIC_FEDERATION_RULE_ID:-fdrl_01RYv2ptEbtu7jpssKo1ZcRH}" \
  ANTHROPIC_ORGANIZATION_ID="${ANTHROPIC_ORGANIZATION_ID:-ff69f7b8-02fa-4bbb-b4a9-d0047c05299c}" \
  ANTHROPIC_SERVICE_ACCOUNT_ID="${ANTHROPIC_SERVICE_ACCOUNT_ID:-svac_014RW8M13t3K3QXY6pL7mrLo}" \
  ANTHROPIC_WORKSPACE_ID="${ANTHROPIC_WORKSPACE_ID:-wrkspc_01K3PnFVDjmiNyuH6DQUJwKo}" \
  WIF_IDENTITY_TOKEN_FILE="${WIF_TOKEN_FILE}" \
  npx jest src/golden.test.ts --verbose "$@"
