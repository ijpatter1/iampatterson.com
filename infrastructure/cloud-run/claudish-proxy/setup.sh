#!/bin/bash
# ═══════════════════════════════════════════════════════
# claudish-proxy — idempotent provisioning + deploy
# feat/claudish. gcloud-first by decision (Phase 11 D9 is
# mid-import on its own branch); IMPORT_PLAN.md documents
# exactly what Terraform adopts later.
#
# Usage:
#   bash setup.sh --dry-run     # print every mutation
#   bash setup.sh               # provision + deploy
# ═══════════════════════════════════════════════════════
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
SERVICE="claudish-proxy"
SA_ID="claudish-proxy"
SA_EMAIL="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"
# Anthropic Workload Identity Federation ids (identifiers, not secrets).
# Created in the Claude Console 2026-08-31 (Settings → Workload identity):
# rule claudish-proxy on the google-cloud issuer, matching this SA's
# sub + email, scoped to the Claudish workspace.
ANTHROPIC_FEDERATION_RULE_ID="${ANTHROPIC_FEDERATION_RULE_ID:-fdrl_01RYv2ptEbtu7jpssKo1ZcRH}"
ANTHROPIC_ORGANIZATION_ID="${ANTHROPIC_ORGANIZATION_ID:-ff69f7b8-02fa-4bbb-b4a9-d0047c05299c}"
ANTHROPIC_SERVICE_ACCOUNT_ID="${ANTHROPIC_SERVICE_ACCOUNT_ID:-svac_014RW8M13t3K3QXY6pL7mrLo}"
ANTHROPIC_WORKSPACE_ID="${ANTHROPIC_WORKSPACE_ID:-wrkspc_01K3PnFVDjmiNyuH6DQUJwKo}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://iampatterson.com,https://iampatterson-com.vercel.app,https://iampatterson-com-*.vercel.app,http://localhost:3000}"
LANES="${LANES:-vertex-global,vertex-regional,anthropic-api,cache-only}"
# cl2en engine: the judge-driven Gemini refinement loop (Ian 2026-09-01).
# en2cl always rides the Claude ladder.
CL2EN_ENGINE="${CL2EN_ENGINE:-gemini-loop}"
GEMINI_MODEL_ID="${GEMINI_MODEL_ID:-gemini-3.5-flash-lite}"
GEMINI_LOCATION="${GEMINI_LOCATION:-global}"  # Gemini 3.x is global-endpoint only on Vertex
DAILY_BUDGET_USD="${DAILY_BUDGET_USD:-23}"
MAX_INSTANCES="${MAX_INSTANCES:-4}"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

run() {
  echo "+ $*"
  [ "${DRY_RUN}" = "1" ] || "$@"
}

command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud required"; exit 1; }
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "❌ gcloud auth expired (the ~hourly Workspace policy). Run: gcloud auth login"
  exit 1
fi

# The deploy gate: pinned model IDs must be verified against Model Garden
# (docs/manual/task-2026-08-31-001.sh --probe is the verification).
if [ "${MODEL_ID_CONFIRMED:-0}" != "1" ]; then
  if [ "${DRY_RUN}" = "1" ]; then
    echo "⚠ MODEL_ID_CONFIRMED != 1 — a real run would refuse to deploy"
  else
    echo "❌ MODEL_ID_CONFIRMED != 1. Verify the model ID first:"
    echo "   bash docs/manual/task-2026-08-31-001.sh --probe"
    echo "   then re-run with MODEL_ID_CONFIRMED=1"
    exit 1
  fi
fi

echo "── Step 1: APIs ──"
for API in aiplatform.googleapis.com run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com; do
  if gcloud services list --enabled --project="${PROJECT}" \
      --filter="config.name=${API}" --format="value(config.name)" | grep -q "${API}"; then
    echo "  ${API} already enabled"
  else
    run gcloud services enable "${API}" --project="${PROJECT}"
  fi
done

echo "── Step 2: Service account ──"
if gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "  ${SA_EMAIL} exists"
else
  run gcloud iam service-accounts create "${SA_ID}" \
    --project="${PROJECT}" \
    --display-name="Claudish translator proxy runtime"
fi

echo "── Step 3: IAM ──"
# aiplatform.user at project scope: model prediction is not
# resource-scopable; this is the minimum practical grant. The SA holds
# no other role; spend cap + rate limits are the compensating controls.
run gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user" \
  --condition=None >/dev/null

# No secret step: the Anthropic lane authenticates via Workload Identity
# Federation (the runtime SA's metadata-server identity token, exchanged
# at api.anthropic.com/v1/oauth/token). The claudish-anthropic-api-key
# secret shell created before the WIF switch is unused break-glass; it
# holds no version and nothing mounts it.

echo "── Step 5: Deploy (source-deploy, buildpacks) ──"
run gcloud run deploy "${SERVICE}" \
  --source . \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --port=8080 \
  --allow-unauthenticated \
  --ingress=all \
  --service-account="${SA_EMAIL}" \
  --min-instances=1 \
  --max-instances="${MAX_INSTANCES}" \
  --concurrency=80 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=60 \
  --execution-environment=gen2 \
  --set-env-vars="^@^ALLOWED_ORIGINS=${ALLOWED_ORIGINS}@LANES=${LANES}@DAILY_BUDGET_USD=${DAILY_BUDGET_USD}@MAX_INSTANCES=${MAX_INSTANCES}@KILL_SWITCH=off@GCP_PROJECT=${PROJECT}@VERTEX_FALLBACK_REGION=us-east5@MODEL_ID_CONFIRMED=${MODEL_ID_CONFIRMED:-0}@ANTHROPIC_FEDERATION_RULE_ID=${ANTHROPIC_FEDERATION_RULE_ID}@ANTHROPIC_ORGANIZATION_ID=${ANTHROPIC_ORGANIZATION_ID}@ANTHROPIC_SERVICE_ACCOUNT_ID=${ANTHROPIC_SERVICE_ACCOUNT_ID}@ANTHROPIC_WORKSPACE_ID=${ANTHROPIC_WORKSPACE_ID}@CL2EN_ENGINE=${CL2EN_ENGINE}@GEMINI_MODEL_ID=${GEMINI_MODEL_ID}@GEMINI_LOCATION=${GEMINI_LOCATION}"

if [ "${DRY_RUN}" = "1" ]; then
  echo ""
  echo "Dry run complete. Nothing was mutated."
  exit 0
fi

URL="$(gcloud run services describe "${SERVICE}" --project="${PROJECT}" --region="${REGION}" --format='value(status.url)')"
echo ""
echo "═══ Deployed ═══"
echo "Service URL:   ${URL}"
echo ""
echo "Next steps:"
echo "  1. Vercel env:  vercel env add NEXT_PUBLIC_CLAUDISH_PROXY_URL"
echo "       value: ${URL}/translate"
echo "  2. Smoke test:  curl -N -X POST '${URL}/translate' \\"
echo "       -H 'Content-Type: application/json' -H 'Origin: https://iampatterson.com' \\"
echo "       -d '{\"text\":\"We fixed the bug.\",\"direction\":\"en2cl\"}'"
echo "  3. Latency:     CLAUDISH_PROXY_URL='${URL}' bash scripts/run-claudish-latency.sh"
echo ""
echo "KILL SWITCH (runbook — takes ~30s to roll):"
echo "  gcloud run services update ${SERVICE} --project=${PROJECT} --region=${REGION} --update-env-vars KILL_SWITCH=on"
echo "  revert: ... --update-env-vars KILL_SWITCH=off"
