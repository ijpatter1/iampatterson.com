#!/bin/bash
# Run a lab command with the credentials both engines need, in the environment only
# (never argv, never echoed): a WIF identity token file for the Anthropic lane and an
# impersonated runtime-SA access token for Gemini. Usage: bash with-lab-env.sh <cmd...>
set -euo pipefail
export PATH=/opt/homebrew/bin:$PATH
SA=claudish-proxy@iampatterson.iam.gserviceaccount.com
TOK="$(mktemp)"; trap 'rm -f "$TOK"' EXIT
if ! gcloud auth print-identity-token --impersonate-service-account="$SA" --audiences=https://api.anthropic.com --include-email > "$TOK"; then
  echo "with-lab-env: identity token mint failed (gcloud re-auth needed? run: gcloud auth login)" >&2; exit 1
fi
export WIF_IDENTITY_TOKEN_FILE="$TOK"
if ! GEMINI_ACCESS_TOKEN="$(gcloud auth print-access-token --impersonate-service-account="$SA")"; then
  echo "with-lab-env: access token mint failed (gcloud re-auth needed? run: gcloud auth login)" >&2; exit 1
fi
export GEMINI_ACCESS_TOKEN
export ANTHROPIC_FEDERATION_RULE_ID="${ANTHROPIC_FEDERATION_RULE_ID:-fdrl_01RYv2ptEbtu7jpssKo1ZcRH}"
export ANTHROPIC_ORGANIZATION_ID="${ANTHROPIC_ORGANIZATION_ID:-ff69f7b8-02fa-4bbb-b4a9-d0047c05299c}"
export ANTHROPIC_SERVICE_ACCOUNT_ID="${ANTHROPIC_SERVICE_ACCOUNT_ID:-svac_014RW8M13t3K3QXY6pL7mrLo}"
export ANTHROPIC_WORKSPACE_ID="${ANTHROPIC_WORKSPACE_ID:-wrkspc_01K3PnFVDjmiNyuH6DQUJwKo}"
export CL2EN_LAB_DIR="${CL2EN_LAB_DIR:-$HOME/.claudish-corpus/analysis/2026-09-01-model-compare}"
export CL2EN_INPUTS="${CL2EN_INPUTS:-$CL2EN_LAB_DIR/cl2en-pool.json}"
export GEMINI_MODEL_ID="${GEMINI_MODEL_ID:-gemini-3.5-flash-lite}" GEMINI_LOCATION="${GEMINI_LOCATION:-global}"
[ -s "$TOK" ] && [ -n "$GEMINI_ACCESS_TOKEN" ] || { echo "credential mint failed" >&2; exit 1; }
exec "$@"
