#!/usr/bin/env bash
#
# Task 6 — IAP (Identity-Aware Proxy) in front of the Metabase load
# balancer. Gates access behind Google SSO with an explicit allowlist.
# See docs/input_artifacts/metabase-deployment-plan.md (Task 6) for spec.
#
# Idempotent. Re-running reconciles the allowlist (adds new members,
# does NOT remove — removal is deliberately manual, see note below).
#
# Prerequisites:
#   - Task 5 complete: backend service `metabase-backend` exists with
#     SSL-terminated LB frontend and ACTIVE cert.
#   - APIs enabled: iap.googleapis.com, iam.googleapis.com.
#   - IAM on executing principal: roles/iap.admin, roles/resourcemanager.projectIamAdmin.
#   - One-time manual setup in GCP Console (see README Task 6 section):
#     APIs & Services → OAuth consent screen, User Type: Internal,
#     App name "iampatterson BI", Support email <you>.
#     This must be done BEFORE running the script; gcloud cannot
#     configure the consent screen for you.
#
# Usage:
#   ./setup-iap.sh
#   ./setup-iap.sh --dry-run

set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-metabase}"
BACKEND_NAME="${BACKEND_NAME:-metabase-backend}"
OAUTH_CLIENT_NAME="${OAUTH_CLIENT_NAME:-metabase-iap-client}"
IAP_CLIENT_ID_SECRET="metabase-iap-client-id"
IAP_CLIENT_SECRET_SECRET="metabase-iap-client-secret"

# -----------------------------------------------------------------------------
# Allowlist — edit this to grant/revoke IAP access.
# -----------------------------------------------------------------------------
# Format: gcloud IAM member strings, e.g.:
#   user:someone@example.com
#   group:team@example.com
#   serviceAccount:svc@project.iam.gserviceaccount.com
#
# Reconciliation semantics (deliberate):
#   - Re-running the script ADDS any member that isn't already bound.
#   - Re-running NEVER removes a member, even if the array shrinks.
#
# Why additive-only: if someone's entry gets accidentally commented out
# or removed from git and the script is re-run, a remove-on-drift design
# would silently lock them out. Manual removal keeps the failure mode
# visible:
#
#   gcloud iap web remove-iam-policy-binding \
#     --resource-type=backend-services --service=metabase-backend \
#     --member="user:someone@example.com" \
#     --role="roles/iap.httpsResourceAccessor"
#
ALLOWLIST=(
  "user:ian@tunameltsmyheart.com"
)

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=true; fi

run() {
  # Warning: do NOT route commands with secret material on the command
  # line through this wrapper (it echoes every call).
  echo "+ $*"
  if ! $DRY_RUN; then "$@"; fi
}

echo "==> Project:         ${PROJECT}"
echo "==> Backend service: ${BACKEND_NAME}"
echo "==> OAuth client:    ${OAUTH_CLIENT_NAME}"
echo "==> Allowlist:       ${#ALLOWLIST[@]} member(s)"
for m in "${ALLOWLIST[@]}"; do echo "                     ${m}"; done
if $DRY_RUN; then echo "==> DRY-RUN mode: no changes will be made"; fi
echo ""

# -----------------------------------------------------------------------------
# Preconditions: backend service exists and OAuth brand exists
# -----------------------------------------------------------------------------
echo "==> Checking precondition: backend service ${BACKEND_NAME}..."
if ! gcloud compute backend-services describe "${BACKEND_NAME}" \
     --global --project="${PROJECT}" >/dev/null 2>&1; then
  cat <<EOF
ERROR: Backend service '${BACKEND_NAME}' not found.
Task 5 (setup-domain.sh) must run before Task 6.
EOF
  exit 1
fi
echo "Backend service present."

echo "==> Checking precondition: iap.googleapis.com enabled..."
IAP_API_ENABLED=$(gcloud services list --enabled \
  --project="${PROJECT}" \
  --filter="config.name:iap.googleapis.com" \
  --format="value(config.name)" 2>/dev/null || echo "")
if [[ -z "${IAP_API_ENABLED}" ]]; then
  if $DRY_RUN; then
    echo "+ gcloud services enable iap.googleapis.com --project=${PROJECT}"
  else
    echo "iap.googleapis.com not enabled. Enabling now (takes ~30s)..."
    gcloud services enable iap.googleapis.com --project="${PROJECT}"
  fi
fi

echo "==> Checking precondition: OAuth consent screen / brand..."
# Don't route gcloud stderr to /dev/null here — if this call fails, the
# 'API not enabled' or permission error should reach the user. Earlier
# versions suppressed stderr and the script exited silently, which was
# unhelpful to debug. Pipeline now uses a tempfile so we can detect real
# errors vs. empty output from a successful "no brands yet" response.
BRAND_LIST=$(mktemp)
trap 'rm -f "${BRAND_LIST}"' EXIT INT TERM
if ! gcloud iap oauth-brands list \
       --project="${PROJECT}" \
       --format="value(name)" > "${BRAND_LIST}"; then
  echo "ERROR: 'gcloud iap oauth-brands list' failed. See output above."
  echo "       Common causes: iap.googleapis.com not enabled (auto-enabled"
  echo "       above — check your gcloud is current), or roles/iap.admin"
  echo "       missing on the executing principal."
  exit 1
fi
BRAND_COUNT=$(wc -l < "${BRAND_LIST}" | tr -d ' ')

if [[ "${BRAND_COUNT}" == "0" ]]; then
  cat <<EOF
ERROR: No OAuth brand found on project ${PROJECT}.

Configure the OAuth consent screen manually first (this is the one
step gcloud cannot automate for Internal-user-type brands):

  1. Open: https://console.cloud.google.com/apis/credentials/consent?project=${PROJECT}
  2. User Type:     Internal
  3. App name:      iampatterson BI
  4. Support email: <your Google account>
  5. Scopes:        default (email, profile, openid)
  6. Save.

Then re-run this script.
EOF
  exit 1
fi

BRAND_NAME=$(head -1 "${BRAND_LIST}")
echo "OAuth brand: ${BRAND_NAME}"

# -----------------------------------------------------------------------------
# 1. OAuth client for IAP
# -----------------------------------------------------------------------------
echo "==> 1/4 OAuth client ${OAUTH_CLIENT_NAME}..."

# Find an existing client by exact displayName match.
# WARNING: if you rename OAUTH_CLIENT_NAME between runs (or fix a typo),
# the script will create a second client rather than rename the first.
# Clean up stale OAuth clients manually via the GCP Console or
# `gcloud iap oauth-clients delete`.
EXISTING_CLIENT=$(gcloud iap oauth-clients list "${BRAND_NAME}" \
  --project="${PROJECT}" \
  --filter="displayName=${OAUTH_CLIENT_NAME}" \
  --format="value(name)" 2>/dev/null || true)

if [[ -n "${EXISTING_CLIENT}" ]]; then
  echo "OAuth client ${OAUTH_CLIENT_NAME} exists, skipping create."
  CLIENT_RESOURCE="${EXISTING_CLIENT}"
else
  echo "Creating OAuth client ${OAUTH_CLIENT_NAME}..."
  if $DRY_RUN; then
    echo "+ gcloud iap oauth-clients create ${BRAND_NAME} --display_name=${OAUTH_CLIENT_NAME}"
    CLIENT_RESOURCE="(dry-run)"
  else
    CLIENT_RESOURCE=$(gcloud iap oauth-clients create "${BRAND_NAME}" \
      --display_name="${OAUTH_CLIENT_NAME}" \
      --project="${PROJECT}" \
      --format="value(name)")
  fi
fi

# Extract the client ID (last path segment of the resource name) and
# fetch the client secret. The client secret is only retrievable from
# gcloud for IAP-managed OAuth clients — keep it out of logs.
if ! $DRY_RUN; then
  CLIENT_ID="${CLIENT_RESOURCE##*/}"
  CLIENT_SECRET=$(gcloud iap oauth-clients describe "${CLIENT_RESOURCE}" \
    --project="${PROJECT}" \
    --format="value(secret)" 2>/dev/null)
  if [[ -z "${CLIENT_SECRET}" ]]; then
    echo "ERROR: Could not read OAuth client secret. Aborting."
    exit 1
  fi
fi

# -----------------------------------------------------------------------------
# 2. Store client ID + secret in Secret Manager
# -----------------------------------------------------------------------------
echo "==> 2/4 Secret ${IAP_CLIENT_ID_SECRET}..."
if gcloud secrets describe "${IAP_CLIENT_ID_SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Secret ${IAP_CLIENT_ID_SECRET} exists, skipping."
else
  run gcloud secrets create "${IAP_CLIENT_ID_SECRET}" \
    --project="${PROJECT}" \
    --replication-policy=automatic \
    --labels=app=metabase,purpose=iap-client-id
  if $DRY_RUN; then
    echo "+ gcloud secrets versions add ${IAP_CLIENT_ID_SECRET} --data-file=- <<< <client-id>"
  else
    printf '%s' "${CLIENT_ID}" | gcloud secrets versions add "${IAP_CLIENT_ID_SECRET}" \
      --project="${PROJECT}" --data-file=-
  fi
fi

echo "==> Secret ${IAP_CLIENT_SECRET_SECRET}..."
if gcloud secrets describe "${IAP_CLIENT_SECRET_SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Secret ${IAP_CLIENT_SECRET_SECRET} exists, skipping."
else
  run gcloud secrets create "${IAP_CLIENT_SECRET_SECRET}" \
    --project="${PROJECT}" \
    --replication-policy=automatic \
    --labels=app=metabase,purpose=iap-client-secret
  if $DRY_RUN; then
    echo "+ gcloud secrets versions add ${IAP_CLIENT_SECRET_SECRET} --data-file=- <<< <client-secret>"
  else
    printf '%s' "${CLIENT_SECRET}" | gcloud secrets versions add "${IAP_CLIENT_SECRET_SECRET}" \
      --project="${PROJECT}" --data-file=-
  fi
fi

# -----------------------------------------------------------------------------
# 3. Enable IAP on the backend service
# -----------------------------------------------------------------------------
echo "==> 3/4 IAP on backend service ${BACKEND_NAME}..."

IAP_STATUS=$(gcloud compute backend-services describe "${BACKEND_NAME}" \
  --global --project="${PROJECT}" \
  --format="value(iap.enabled)" 2>/dev/null || echo "")
if [[ "${IAP_STATUS}" == "True" ]]; then
  echo "IAP already enabled on ${BACKEND_NAME}, skipping."
else
  if $DRY_RUN; then
    echo "+ gcloud iap web enable --resource-type=backend-services \\"
    echo "    --service=${BACKEND_NAME} \\"
    echo "    --oauth2-client-id=<redacted> --oauth2-client-secret=<redacted>"
  else
    gcloud iap web enable \
      --resource-type=backend-services \
      --service="${BACKEND_NAME}" \
      --oauth2-client-id="${CLIENT_ID}" \
      --oauth2-client-secret="${CLIENT_SECRET}" \
      --project="${PROJECT}"
  fi
fi

# Clear secret material from the shell environment.
unset CLIENT_SECRET

# -----------------------------------------------------------------------------
# 3b. Provision the IAP service agent and grant it run.invoker
# -----------------------------------------------------------------------------
# Once IAP is enforcing, the request path to Cloud Run is:
#     browser → IAP → (as the IAP service agent) → Cloud Run
# The IAP service agent has its own identity, separate from the anonymous
# allUsers binding deploy.sh grants for the pre-IAP path. Without this
# service agent + its run.invoker binding, browser requests through IAP
# get Metabase's LB page replaced with: "The IAP service account is
# not provisioned. Please follow the instructions to create service
# account and rectify IAP and Cloud Run setup".
#
# `gcloud beta services identity create` is idempotent: re-runs return
# the same agent and exit 0.
echo "==> 3b/4 Provisioning IAP service agent..."
if $DRY_RUN; then
  echo "+ gcloud beta services identity create --service=iap.googleapis.com --project=${PROJECT}"
  IAP_SA_EMAIL="service-<PROJECT_NUMBER>@gcp-sa-iap.iam.gserviceaccount.com"
else
  IAP_IDENTITY_OUT=$(gcloud beta services identity create \
    --service=iap.googleapis.com \
    --project="${PROJECT}" 2>&1)
  echo "${IAP_IDENTITY_OUT}"
  # Agent email is stable: service-<project-number>@gcp-sa-iap...
  PROJECT_NUMBER=$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)')
  IAP_SA_EMAIL="service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com"
fi
echo "IAP service agent: ${IAP_SA_EMAIL}"

# Resolve the Cloud Run service name and region from the NEG attached to
# the backend service. Keeps this script decoupled from deploy.sh's
# hard-coded values while still reliable.
CLOUD_RUN_SERVICE="${SERVICE_NAME:-metabase}"
CLOUD_RUN_REGION="${REGION:-us-central1}"

echo "==> Granting IAP agent run.invoker on Cloud Run service ${CLOUD_RUN_SERVICE}..."
run gcloud run services add-iam-policy-binding "${CLOUD_RUN_SERVICE}" \
  --region="${CLOUD_RUN_REGION}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${IAP_SA_EMAIL}" \
  --role="roles/run.invoker" \
  --quiet

# -----------------------------------------------------------------------------
# 4. Reconcile the allowlist (additive only)
# -----------------------------------------------------------------------------
echo "==> 4/4 Reconciling allowlist (additive; members never removed)..."

for MEMBER in "${ALLOWLIST[@]}"; do
  echo "  Granting roles/iap.httpsResourceAccessor to ${MEMBER}..."
  # NOTE: gcloud iap web add-iam-policy-binding does NOT accept the
  # --condition flag (unlike projects/secrets bindings). IAP IAM
  # bindings are always unconditional — do not add --condition here.
  run gcloud iap web add-iam-policy-binding \
    --resource-type=backend-services \
    --service="${BACKEND_NAME}" \
    --member="${MEMBER}" \
    --role="roles/iap.httpsResourceAccessor" \
    --project="${PROJECT}" >/dev/null
done

echo ""
echo "==> Done."
echo ""
echo "Verify:"
echo "  curl -sI https://bi.iampatterson.com/ | head -3"
echo "  # expect: HTTP/2 302, Location: https://accounts.google.com/..."
echo ""
echo "  gcloud compute backend-services describe ${BACKEND_NAME} \\"
echo "    --global --project=${PROJECT} --format='value(iap.enabled)'"
echo "  # expect: True"
echo ""
echo "  gcloud iap web get-iam-policy \\"
echo "    --resource-type=backend-services --service=${BACKEND_NAME} \\"
echo "    --project=${PROJECT} --format='value(bindings.members)'"
echo "  # expect: all ALLOWLIST members"
