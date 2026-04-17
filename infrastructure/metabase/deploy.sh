#!/usr/bin/env bash
#
# Task 3 — Deploy Metabase to Cloud Run.
# See docs/input_artifacts/metabase-deployment-plan.md (Task 3) for the spec.
#
# Renders infrastructure/metabase/cloudrun.yaml with envsubst (or a sed
# fallback on systems where envsubst is unavailable) and applies via
# `gcloud run services replace`. Idempotent — replace is a no-op update
# if the effective spec is unchanged.
#
# Prerequisites:
#   - Tasks 1 and 2 completed (Cloud SQL instance, SAs, secrets).
#   - APIs enabled: run.googleapis.com, compute.googleapis.com
#     (required for Direct VPC egress on gen2).
#   - IAM on executing principal:
#       roles/run.admin, roles/iam.serviceAccountUser (to deploy a service
#       that runs as metabase-runtime), roles/compute.networkViewer.
#   - METABASE_IMAGE pinned to an exact tag (the script refuses to deploy
#     the ':...x' placeholder). Check
#     https://github.com/metabase/metabase/releases for the current
#     stable patch of v0.59.6.
#
# Usage:
#   ./deploy.sh
#   ./deploy.sh --dry-run
#   METABASE_IMAGE=metabase/metabase:v0.59.6 ./deploy.sh

set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-metabase}"
# The plan pins the Metabase image to v0.59.6.x — resolve the trailing
# '.x' to the current stable patch before running.
METABASE_IMAGE="${METABASE_IMAGE:-metabase/metabase:v0.59.6.x}"
RUNTIME_SA_EMAIL="metabase-runtime@${PROJECT}.iam.gserviceaccount.com"
CLOUDSQL_CONNECTION_NAME="${PROJECT}:${REGION}:metabase-app-db"
DOMAIN="${DOMAIN:-bi.iampatterson.com}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/cloudrun.yaml"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

echo "==> Project:    ${PROJECT}"
echo "==> Region:     ${REGION}"
echo "==> Service:    ${SERVICE_NAME}"
echo "==> Image:      ${METABASE_IMAGE}"
echo "==> Runtime SA: ${RUNTIME_SA_EMAIL}"
echo "==> Cloud SQL:  ${CLOUDSQL_CONNECTION_NAME}"
echo "==> Domain:     ${DOMAIN}"
if $DRY_RUN; then echo "==> DRY-RUN mode: no changes will be made"; fi
echo ""

# -----------------------------------------------------------------------------
# Refuse to deploy a placeholder image tag
# -----------------------------------------------------------------------------
if [[ "${METABASE_IMAGE}" == *.x || "${METABASE_IMAGE}" == *latest ]]; then
  cat <<EOF
ERROR: METABASE_IMAGE must be pinned to an exact tag. Got: ${METABASE_IMAGE}

Check https://github.com/metabase/metabase/releases for the current
stable patch of v0.59.6, then re-run with:

  METABASE_IMAGE=metabase/metabase:v0.59.6 ./deploy.sh
EOF
  exit 1
fi

# -----------------------------------------------------------------------------
# Preconditions — Tasks 1 and 2 must be complete
# -----------------------------------------------------------------------------
echo "==> Checking preconditions..."

if ! gcloud iam service-accounts describe "${RUNTIME_SA_EMAIL}" \
     --project="${PROJECT}" >/dev/null 2>&1; then
  echo "ERROR: Service account ${RUNTIME_SA_EMAIL} not found. Run setup-iam.sh first."
  exit 1
fi

if ! gcloud sql instances describe metabase-app-db \
     --project="${PROJECT}" >/dev/null 2>&1; then
  echo "ERROR: Cloud SQL instance metabase-app-db not found. Run setup-cloudsql.sh first."
  exit 1
fi

for SECRET in metabase-db-password metabase-encryption-key; do
  if ! gcloud secrets describe "${SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
    echo "ERROR: Secret ${SECRET} not found. Complete Tasks 1 and 2 first."
    exit 1
  fi
done

echo "Preconditions OK."

# -----------------------------------------------------------------------------
# Render the service spec
# -----------------------------------------------------------------------------
RENDERED=$(mktemp)
trap 'rm -f "${RENDERED}"' EXIT INT TERM

# Export for envsubst; also used by the sed fallback.
export SERVICE_NAME
export PROJECT
export IMAGE="${METABASE_IMAGE}"
export RUNTIME_SA_EMAIL
export CLOUDSQL_CONNECTION_NAME
export DOMAIN

echo "==> Rendering service spec..."
if command -v envsubst >/dev/null 2>&1; then
  envsubst '${SERVICE_NAME} ${PROJECT} ${IMAGE} ${RUNTIME_SA_EMAIL} ${CLOUDSQL_CONNECTION_NAME} ${DOMAIN}' \
    < "${TEMPLATE}" > "${RENDERED}"
else
  sed \
    -e "s|\${SERVICE_NAME}|${SERVICE_NAME}|g" \
    -e "s|\${PROJECT}|${PROJECT}|g" \
    -e "s|\${IMAGE}|${IMAGE}|g" \
    -e "s|\${RUNTIME_SA_EMAIL}|${RUNTIME_SA_EMAIL}|g" \
    -e "s|\${CLOUDSQL_CONNECTION_NAME}|${CLOUDSQL_CONNECTION_NAME}|g" \
    -e "s|\${DOMAIN}|${DOMAIN}|g" \
    "${TEMPLATE}" > "${RENDERED}"
fi

# Guard against unresolved placeholders leaking into a deploy.
if grep -q '\${' "${RENDERED}"; then
  echo "ERROR: Rendered spec contains unresolved \${...} placeholders:"
  grep -n '\${' "${RENDERED}"
  exit 1
fi

echo "==> Rendered spec:"
cat "${RENDERED}"
echo ""

# -----------------------------------------------------------------------------
# Apply
# -----------------------------------------------------------------------------
if $DRY_RUN; then
  echo "==> DRY-RUN: would run"
  echo "    gcloud run services replace ${RENDERED} \\"
  echo "      --region=${REGION} --project=${PROJECT}"
else
  echo "==> Applying service spec..."
  gcloud run services replace "${RENDERED}" \
    --region="${REGION}" \
    --project="${PROJECT}"
fi

echo ""
echo "==> Done."
echo ""
echo "Verify:"
echo "  gcloud run services describe ${SERVICE_NAME} \\"
echo "    --region=${REGION} --project=${PROJECT} \\"
echo "    --format='value(status.url,status.conditions[0].status,spec.template.spec.containers[0].image)'"
echo "  # expect Ready=True, a .run.app URL, and the pinned image tag"
echo ""
echo "  URL=\$(gcloud run services describe ${SERVICE_NAME} \\"
echo "    --region=${REGION} --project=${PROJECT} --format='value(status.url)')"
echo "  curl -sI \"\${URL}/api/health\" | head -1"
echo "  # expect 404 / 403 / connection refused (ingress locked to LB — .run.app is blocked)"
echo ""
echo "Cold start takes ~60-120s on first request after idle. With min-instances=1"
echo "the service should stay warm once reached via the LB (Task 5)."
