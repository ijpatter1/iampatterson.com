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
CLOUDSQL_INSTANCE="${CLOUDSQL_INSTANCE:-metabase-app-db}"
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
echo "==> Cloud SQL:  ${CLOUDSQL_INSTANCE} (private IP — resolved at render time)"
echo "==> Domain:     ${DOMAIN}"
if $DRY_RUN; then echo "==> DRY-RUN mode: no changes will be made"; fi
echo ""

# -----------------------------------------------------------------------------
# Refuse to deploy anything other than a pinned Metabase semver tag
# -----------------------------------------------------------------------------
# Positive allowlist: metabase/metabase:vMAJOR.MINOR.PATCH with optional
# .BUILD. Rejects 'latest', 'stable', partial versions, 'x' placeholders,
# and any other floating tag.
METABASE_IMAGE_RE='^metabase/metabase:v[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$'
if [[ ! "${METABASE_IMAGE}" =~ ${METABASE_IMAGE_RE} ]]; then
  cat <<EOF
ERROR: METABASE_IMAGE must be pinned to an exact version tag. Got:
  ${METABASE_IMAGE}

Expected shape: metabase/metabase:vMAJOR.MINOR.PATCH[.BUILD]

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

if ! gcloud sql instances describe "${CLOUDSQL_INSTANCE}" \
     --project="${PROJECT}" >/dev/null 2>&1; then
  echo "ERROR: Cloud SQL instance ${CLOUDSQL_INSTANCE} not found. Run setup-cloudsql.sh first."
  exit 1
fi

# Resolve the Cloud SQL private IP. Metabase talks plain TCP to this —
# no Auth Proxy sidecar. Filter for type=PRIVATE so we fail loudly if
# the instance was accidentally granted a public IP (the setup script
# provisions private-only, but a console edit could drift).
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq required (used to filter Cloud SQL IP addresses by type)."
  echo "Install: apt-get install -y jq  |  brew install jq"
  exit 1
fi
CLOUDSQL_PRIVATE_IP=$(gcloud sql instances describe "${CLOUDSQL_INSTANCE}" \
  --project="${PROJECT}" --format=json \
  | jq -r '[.ipAddresses[]? | select(.type=="PRIVATE") | .ipAddress][0] // empty')
if [[ -z "${CLOUDSQL_PRIVATE_IP}" ]]; then
  echo "ERROR: No PRIVATE-type IP on Cloud SQL instance ${CLOUDSQL_INSTANCE}."
  echo "       The instance must have a private IP (google-managed-services VPC peering)."
  echo "       Inspect: gcloud sql instances describe ${CLOUDSQL_INSTANCE} --project=${PROJECT} --format=json"
  exit 1
fi
echo "==> Cloud SQL private IP: ${CLOUDSQL_PRIVATE_IP}"

for SECRET in metabase-db-password metabase-encryption-key; do
  if ! gcloud secrets describe "${SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
    echo "ERROR: Secret ${SECRET} not found. Complete Tasks 1 and 2 first."
    exit 1
  fi
done

# The principal deploying this must have roles/iam.serviceAccountUser
# on the runtime SA — Cloud Run refuses to deploy a service that runs
# as an SA the deployer cannot "act as". The failure message from
# `services replace` is cryptic; check up front and surface it clearly.
EXECUTING_ACCOUNT=$(gcloud config get-value account 2>/dev/null || echo "")
if [[ -n "${EXECUTING_ACCOUNT}" ]]; then
  SA_MEMBER_CHECK=$(gcloud iam service-accounts get-iam-policy "${RUNTIME_SA_EMAIL}" \
    --project="${PROJECT}" \
    --flatten="bindings[].members" \
    --filter="bindings.role=roles/iam.serviceAccountUser AND bindings.members~${EXECUTING_ACCOUNT}" \
    --format="value(bindings.role)" 2>/dev/null || true)
  # An Owner/Editor at the project level also satisfies this check
  # implicitly — don't hard-fail on absence, just warn.
  if [[ -z "${SA_MEMBER_CHECK}" ]]; then
    echo "NOTE: Could not confirm ${EXECUTING_ACCOUNT} has"
    echo "      roles/iam.serviceAccountUser on ${RUNTIME_SA_EMAIL}."
    echo "      If the deploy fails with a 'cannot act as service account'"
    echo "      error, grant it:"
    echo ""
    echo "  gcloud iam service-accounts add-iam-policy-binding ${RUNTIME_SA_EMAIL} \\"
    echo "    --project=${PROJECT} \\"
    echo "    --member='user:${EXECUTING_ACCOUNT}' \\"
    echo "    --role='roles/iam.serviceAccountUser'"
    echo ""
  fi
fi

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
export CLOUDSQL_PRIVATE_IP
export DOMAIN

echo "==> Rendering service spec..."
# Two-layer placeholder defense:
#   1. envsubst allowlist restricts substitution to the known variables,
#      so stray env-var-like strings in the yaml are not expanded.
#   2. Post-render grep catches any ${VAR} pattern the allowlist missed
#      (e.g., a new placeholder added to the yaml without updating this
#      allowlist). Both checks must pass before the yaml is applied.
if command -v envsubst >/dev/null 2>&1; then
  envsubst '${SERVICE_NAME} ${PROJECT} ${IMAGE} ${RUNTIME_SA_EMAIL} ${CLOUDSQL_PRIVATE_IP} ${DOMAIN}' \
    < "${TEMPLATE}" > "${RENDERED}"
else
  sed \
    -e "s|\${SERVICE_NAME}|${SERVICE_NAME}|g" \
    -e "s|\${PROJECT}|${PROJECT}|g" \
    -e "s|\${IMAGE}|${IMAGE}|g" \
    -e "s|\${RUNTIME_SA_EMAIL}|${RUNTIME_SA_EMAIL}|g" \
    -e "s|\${CLOUDSQL_PRIVATE_IP}|${CLOUDSQL_PRIVATE_IP}|g" \
    -e "s|\${DOMAIN}|${DOMAIN}|g" \
    "${TEMPLATE}" > "${RENDERED}"
fi

# Match ${NAME} where NAME is uppercase + underscore only — the envsubst
# convention. Avoids tripping on legitimate $-prefixed content in env
# values (e.g., a future property-expansion syntax in JAVA_TOOL_OPTIONS).
# Strip YAML comments first: the template's header explains the placeholder
# syntax and legitimately contains a `${VAR}` example, which must not trip
# the leak guard on rendered output.
if grep -vE '^[[:space:]]*#' "${RENDERED}" | grep -q -E '\$\{[A-Z_]+\}'; then
  echo "ERROR: Rendered spec contains unresolved \${VAR} placeholders:"
  grep -nE '\$\{[A-Z_]+\}' "${RENDERED}" | grep -vE ':[[:space:]]*#'
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
  echo "    gcloud run services add-iam-policy-binding ${SERVICE_NAME} \\"
  echo "      --region=${REGION} --project=${PROJECT} \\"
  echo "      --member=allUsers --role=roles/run.invoker"
else
  echo "==> Applying service spec..."
  gcloud run services replace "${RENDERED}" \
    --region="${REGION}" \
    --project="${PROJECT}"

  # Grant allUsers the run.invoker role so the external HTTPS LB's
  # serverless NEG can invoke Cloud Run. This looks permissive but isn't:
  # ingress=internal-and-cloud-load-balancing already blocks the .run.app
  # URL, and IAP on the backend service (Task 6) gates who can reach the
  # LB in the first place. Without this binding, Cloud Run returns a GFE
  # 403 ("Your client does not have permission") on every LB request —
  # serverless NEGs don't carry a service identity the LB could use to
  # authenticate. gcloud treats an existing binding as a no-op here, so
  # re-running this script is safe.
  echo "==> Granting allUsers run.invoker (LB-via-serverless-NEG pattern)..."
  gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --member=allUsers \
    --role=roles/run.invoker \
    --quiet >/dev/null
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
