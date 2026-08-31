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
SECRET="claudish-anthropic-api-key"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://iampatterson-com.vercel.app,https://iampatterson.com}"
LANES="${LANES:-vertex-global,vertex-regional,anthropic-api,cache-only}"
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

echo "── Step 4: Secret shell ──"
if gcloud secrets describe "${SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "  ${SECRET} exists"
else
  run gcloud secrets create "${SECRET}" --project="${PROJECT}" \
    --replication-policy=automatic --labels=app=claudish,purpose=anthropic-api-key
fi
# Value is added by the operator (docs/manual/task-2026-08-31-001.sh),
# never by this script — key material stays off argv and out of echo.
run gcloud secrets add-iam-policy-binding "${SECRET}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None >/dev/null

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
  --set-env-vars="ALLOWED_ORIGINS=${ALLOWED_ORIGINS},LANES=${LANES},DAILY_BUDGET_USD=${DAILY_BUDGET_USD},MAX_INSTANCES=${MAX_INSTANCES},KILL_SWITCH=off,GCP_PROJECT=${PROJECT},VERTEX_FALLBACK_REGION=us-east5,MODEL_ID_CONFIRMED=${MODEL_ID_CONFIRMED:-0}" \
  --set-secrets="ANTHROPIC_API_KEY=${SECRET}:latest"

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
