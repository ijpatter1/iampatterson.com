#!/usr/bin/env bash
#
# Task 5 — External HTTPS load balancer + Google-managed SSL cert for
# Metabase on bi.iampatterson.com. Required for IAP in Task 6: IAP on
# Cloud Run works only through a LB-fronted backend service, not on the
# direct .run.app URL.
#
# See docs/input_artifacts/metabase-deployment-plan.md (Task 5) for spec.
#
# Idempotent. Safe to re-run; existence checks skip create steps that
# already ran. If interrupted during cert provisioning, re-run and the
# script resumes from the cert-polling step.
#
# Prerequisites:
#   - Task 3 deployed: Cloud Run service `metabase` exists in us-central1.
#   - APIs enabled: compute.googleapis.com (Google-managed SSL certs and
#     all LB components are compute API resources — Certificate Manager
#     is a separate product we do NOT use here).
#   - IAM on executing principal: roles/compute.loadBalancerAdmin,
#     roles/compute.networkAdmin.
#
# One manual step: a DNS A record at your domain registrar pointing
# bi.iampatterson.com → the static IP the script prints. Google-managed
# certs will not provision until DNS resolves to the LB.
#
# Usage:
#   ./setup-domain.sh              # provision + print DNS + poll cert
#   ./setup-domain.sh --dry-run    # print commands; no changes
#   ./setup-domain.sh --no-wait    # provision + print DNS; skip cert poll

set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
DOMAIN="${DOMAIN:-bi.iampatterson.com}"
SERVICE_NAME="${SERVICE_NAME:-metabase}"
STATIC_IP_NAME="${STATIC_IP_NAME:-metabase-lb-ip}"
NEG_NAME="${NEG_NAME:-metabase-neg}"
BACKEND_NAME="${BACKEND_NAME:-metabase-backend}"
URL_MAP_NAME="${URL_MAP_NAME:-metabase-url-map}"
CERT_NAME="${CERT_NAME:-metabase-cert}"
HTTPS_PROXY_NAME="${HTTPS_PROXY_NAME:-metabase-https-proxy}"
FORWARDING_RULE_NAME="${FORWARDING_RULE_NAME:-metabase-forwarding-rule}"

DRY_RUN=false
NO_WAIT=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --no-wait) NO_WAIT=true ;;
  esac
done

run() {
  # Does NOT route commands with secret material on the command line
  # through this wrapper. None of Task 5's gcloud calls carry secrets.
  echo "+ $*"
  if ! $DRY_RUN; then "$@"; fi
}

echo "==> Project:  ${PROJECT}"
echo "==> Region:   ${REGION}"
echo "==> Domain:   ${DOMAIN}"
echo "==> Service:  ${SERVICE_NAME}"
if $DRY_RUN; then echo "==> DRY-RUN mode: no changes will be made"; fi
echo ""

# -----------------------------------------------------------------------------
# Precondition: Task 3 Cloud Run service must exist
# -----------------------------------------------------------------------------
echo "==> Checking precondition: Cloud Run service ${SERVICE_NAME}..."
if ! gcloud run services describe "${SERVICE_NAME}" \
     --region="${REGION}" --project="${PROJECT}" >/dev/null 2>&1; then
  cat <<EOF
ERROR: Cloud Run service '${SERVICE_NAME}' not found in ${REGION}.
Task 3 (deploy.sh) must run successfully before Task 5.
EOF
  exit 1
fi
echo "Service present."

# -----------------------------------------------------------------------------
# 1. Reserved global static IP
# -----------------------------------------------------------------------------
echo "==> 1/7 Static IP ${STATIC_IP_NAME}..."
if gcloud compute addresses describe "${STATIC_IP_NAME}" \
     --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Static IP ${STATIC_IP_NAME} exists, skipping."
else
  run gcloud compute addresses create "${STATIC_IP_NAME}" \
    --global \
    --ip-version=IPV4 \
    --project="${PROJECT}"
fi

STATIC_IP=$(gcloud compute addresses describe "${STATIC_IP_NAME}" \
  --global --project="${PROJECT}" \
  --format='value(address)' 2>/dev/null || echo "")
echo "Static IP address: ${STATIC_IP:-<unknown>}"

# -----------------------------------------------------------------------------
# 2. Google-managed SSL cert for the domain
# -----------------------------------------------------------------------------
echo "==> 2/7 SSL cert ${CERT_NAME} for ${DOMAIN}..."
if gcloud compute ssl-certificates describe "${CERT_NAME}" \
     --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Cert ${CERT_NAME} exists, skipping."
else
  run gcloud compute ssl-certificates create "${CERT_NAME}" \
    --domains="${DOMAIN}" \
    --global \
    --project="${PROJECT}"
fi

# -----------------------------------------------------------------------------
# 3. Serverless NEG pointing at the Cloud Run service
# -----------------------------------------------------------------------------
echo "==> 3/7 Serverless NEG ${NEG_NAME}..."
if gcloud compute network-endpoint-groups describe "${NEG_NAME}" \
     --region="${REGION}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "NEG ${NEG_NAME} exists, skipping."
else
  run gcloud compute network-endpoint-groups create "${NEG_NAME}" \
    --region="${REGION}" \
    --network-endpoint-type=serverless \
    --cloud-run-service="${SERVICE_NAME}" \
    --project="${PROJECT}"
fi

# -----------------------------------------------------------------------------
# 4. Backend service wrapping the NEG (IAP attaches here in Task 6)
# -----------------------------------------------------------------------------
echo "==> 4/7 Backend service ${BACKEND_NAME}..."
BACKEND_EXISTS=false
if gcloud compute backend-services describe "${BACKEND_NAME}" \
     --global --project="${PROJECT}" >/dev/null 2>&1; then
  BACKEND_EXISTS=true
fi

# Heal-in-place for a pre-fix misconfiguration: earlier versions of this
# script passed --protocol=HTTPS, which auto-set portName=https. Serverless
# NEGs reject any portName ('Port name is not supported for a backend
# service with Serverless network endpoint groups'). If we detect a
# non-empty portName on the existing backend, delete and recreate.
#
# Safety check: refuse to destroy the backend if IAP is enabled on it.
# Deleting a backend with IAP wired destroys the IAP config silently;
# Task 6 would have to be re-run. A successful deploy won't hit this
# path (backend is created without portName from the start), so the
# guard only fires when someone re-runs after drift has accumulated.
if $BACKEND_EXISTS; then
  CURRENT_PORT_NAME=$(gcloud compute backend-services describe "${BACKEND_NAME}" \
    --global --project="${PROJECT}" --format='value(portName)' 2>/dev/null || echo "")
  CURRENT_IAP_ENABLED=$(gcloud compute backend-services describe "${BACKEND_NAME}" \
    --global --project="${PROJECT}" --format='value(iap.enabled)' 2>/dev/null || echo "")
  if [[ -n "${CURRENT_PORT_NAME}" ]]; then
    if [[ "${CURRENT_IAP_ENABLED}" == "True" ]]; then
      cat <<EOF
ERROR: Backend ${BACKEND_NAME} has portName='${CURRENT_PORT_NAME}' (incompatible
with serverless NEG) AND IAP is enabled. The only way to clear portName is
to delete and recreate the backend, which destroys the IAP config.

Manual steps (one-time):
  1. Disable IAP temporarily:
       gcloud iap web disable --resource-type=backend-services \\
         --service=${BACKEND_NAME} --project=${PROJECT}
  2. Re-run this script to heal the backend.
  3. Re-run ./setup-iap.sh to re-enable IAP and restore the allowlist.

This path should never fire on a clean deploy; you only see it if a
prior run used an older version of this script that created the
backend with --protocol=HTTPS.
EOF
      exit 1
    fi
    echo "Backend ${BACKEND_NAME} has portName='${CURRENT_PORT_NAME}' — incompatible with serverless NEG. Recreating (IAP not enabled, safe)."
    run gcloud compute backend-services delete "${BACKEND_NAME}" \
      --global --project="${PROJECT}" --quiet
    BACKEND_EXISTS=false
  else
    echo "Backend service ${BACKEND_NAME} exists with compatible config, skipping create."
  fi
fi

if ! $BACKEND_EXISTS; then
  # EXTERNAL_MANAGED = Global External Application Load Balancer — the
  # modern scheme that supports serverless NEGs, IAP attachment, and
  # gRPC. Required for the forwarding rule below to use the same scheme.
  # No --protocol flag: serverless NEGs do not accept a portName, and
  # --protocol=HTTPS auto-sets portName=https.
  run gcloud compute backend-services create "${BACKEND_NAME}" \
    --global \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --project="${PROJECT}"
fi

# Attach the NEG. add-backend is not natively idempotent — re-attaching
# the same NEG errors. Detect via basename exact match (not substring —
# that would false-positive on e.g. 'metabase-neg-v2' if one existed).
if gcloud compute backend-services describe "${BACKEND_NAME}" \
     --global --project="${PROJECT}" \
     --format="value(backends[].group.basename())" 2>/dev/null \
     | tr '[:space:]' '\n' \
     | grep -Fxq "${NEG_NAME}"; then
  echo "NEG ${NEG_NAME} already attached to ${BACKEND_NAME}, skipping."
else
  run gcloud compute backend-services add-backend "${BACKEND_NAME}" \
    --global \
    --network-endpoint-group="${NEG_NAME}" \
    --network-endpoint-group-region="${REGION}" \
    --project="${PROJECT}"
fi

# -----------------------------------------------------------------------------
# 5. URL map routing / → backend service
# -----------------------------------------------------------------------------
echo "==> 5/7 URL map ${URL_MAP_NAME}..."
if gcloud compute url-maps describe "${URL_MAP_NAME}" \
     --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "URL map ${URL_MAP_NAME} exists, skipping."
else
  run gcloud compute url-maps create "${URL_MAP_NAME}" \
    --default-service="${BACKEND_NAME}" \
    --global \
    --project="${PROJECT}"
fi

# -----------------------------------------------------------------------------
# 6. Target HTTPS proxy (binds URL map to SSL cert)
# -----------------------------------------------------------------------------
echo "==> 6/7 Target HTTPS proxy ${HTTPS_PROXY_NAME}..."
if gcloud compute target-https-proxies describe "${HTTPS_PROXY_NAME}" \
     --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "HTTPS proxy ${HTTPS_PROXY_NAME} exists, skipping."
else
  run gcloud compute target-https-proxies create "${HTTPS_PROXY_NAME}" \
    --url-map="${URL_MAP_NAME}" \
    --ssl-certificates="${CERT_NAME}" \
    --global \
    --project="${PROJECT}"
fi

# -----------------------------------------------------------------------------
# 7. Global forwarding rule (static IP:443 → HTTPS proxy)
# -----------------------------------------------------------------------------
echo "==> 7/7 Forwarding rule ${FORWARDING_RULE_NAME}..."
if gcloud compute forwarding-rules describe "${FORWARDING_RULE_NAME}" \
     --global --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Forwarding rule ${FORWARDING_RULE_NAME} exists, skipping."
else
  run gcloud compute forwarding-rules create "${FORWARDING_RULE_NAME}" \
    --address="${STATIC_IP_NAME}" \
    --target-https-proxy="${HTTPS_PROXY_NAME}" \
    --global \
    --ports=443 \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --project="${PROJECT}"
fi

# -----------------------------------------------------------------------------
# DNS step (manual — the one thing we can't script)
# -----------------------------------------------------------------------------
cat <<EOF

================================================================================
DNS step (manual):

Create an A record at your domain registrar pointing:

  ${DOMAIN}  A  ${STATIC_IP}  (TTL: 300s or your registrar's minimum)

Google-managed SSL certs will not provision until DNS resolves to this IP.
Cert provisioning then takes 15-60 minutes (Google validates ownership via
HTTP + waits for CT logs to propagate).
================================================================================

EOF

if $NO_WAIT; then
  echo "==> --no-wait flag set; exiting without polling cert status."
  echo "Re-run the script (without --no-wait) after DNS propagates to resume polling."
  exit 0
fi

# -----------------------------------------------------------------------------
# Poll cert until ACTIVE (up to 60 min)
# -----------------------------------------------------------------------------
echo ""
echo "==> Polling SSL cert status (up to 60 minutes)..."
echo "   Press Ctrl+C to stop polling; re-run to resume."
echo ""

MAX_ATTEMPTS=120  # 120 * 30s = 60 min
for ((i=1; i<=MAX_ATTEMPTS; i++)); do
  if $DRY_RUN; then
    echo "+ (dry-run) gcloud compute ssl-certificates describe ${CERT_NAME} --format='value(managed.status)'"
    break
  fi
  STATUS=$(gcloud compute ssl-certificates describe "${CERT_NAME}" \
    --global --project="${PROJECT}" \
    --format='value(managed.status)' 2>/dev/null || echo "UNKNOWN")
  DOMAIN_STATUS=$(gcloud compute ssl-certificates describe "${CERT_NAME}" \
    --global --project="${PROJECT}" \
    --format="value(managed.domainStatus.${DOMAIN})" 2>/dev/null || echo "UNKNOWN")

  TS=$(date +%H:%M:%S)
  echo "[${TS}] attempt ${i}/${MAX_ATTEMPTS} — cert: ${STATUS}, domain: ${DOMAIN_STATUS}"

  if [[ "${STATUS}" == "ACTIVE" ]]; then
    echo ""
    echo "==> SSL cert ACTIVE."
    break
  fi
  # Any FAILED_* status is terminal — polling further is wasted time.
  # Common ones: FAILED_NOT_VISIBLE (DNS not resolving to the LB),
  # FAILED_CAA_CHECKING / FAILED_CAA_FORBIDDEN (CAA record blocks
  # Google's issuer), FAILED_RATE_LIMITED (too many recent attempts).
  if [[ "${STATUS}" == FAILED_* || "${DOMAIN_STATUS}" == FAILED_* ]]; then
    echo ""
    echo "ERROR: Cert reached terminal failure."
    echo "  cert status:    ${STATUS}"
    echo "  domain status:  ${DOMAIN_STATUS}"
    case "${STATUS}${DOMAIN_STATUS}" in
      *NOT_VISIBLE*)
        echo "  fix: verify DNS resolves to ${STATIC_IP}"
        echo "       (dig ${DOMAIN} +short)" ;;
      *CAA*)
        echo "  fix: update registrar CAA records to allow"
        echo "       'pki.goog' or remove the CAA block entirely" ;;
      *RATE_LIMITED*)
        echo "  fix: wait before retrying (rate limits are per-domain, per-hour)" ;;
    esac
    exit 1
  fi

  sleep 30
done

if ! $DRY_RUN; then
  FINAL=$(gcloud compute ssl-certificates describe "${CERT_NAME}" \
    --global --project="${PROJECT}" \
    --format='value(managed.status)' 2>/dev/null || echo "UNKNOWN")
  if [[ "${FINAL}" != "ACTIVE" ]]; then
    echo ""
    echo "WARNING: Cert did not reach ACTIVE after 60 min (status: ${FINAL})."
    echo "         Re-run to keep polling, or check the console for details."
    exit 1
  fi
fi

echo ""
echo "==> Done."
echo ""
echo "Verify:"
echo "  curl -sI https://${DOMAIN}/api/health | head -3"
echo "  # expect HTTP/2 200 once IAP is not yet attached (Task 6 will flip this"
echo "  # to a 302 redirect to accounts.google.com)."
echo ""
echo "  URL=\$(gcloud run services describe ${SERVICE_NAME} \\"
echo "    --region=${REGION} --project=${PROJECT} --format='value(status.url)')"
echo "  curl -sI \"\${URL}/api/health\" | head -1"
echo "  # expect 404/403 — .run.app still locked (ingress=internal-and-cloud-load-balancing)."
