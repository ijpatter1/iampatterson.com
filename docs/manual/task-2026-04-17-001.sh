#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# Task 3 — Deploy Metabase to Cloud Run
# Created: 2026-04-17, session-2026-04-17-020
# Phase: 9B-infra
# Blocks: Task 5 (LB needs a live Cloud Run backend), Task 6 (IAP attaches
#         to LB), Task 7 (Metabase UI), Phase 9B deliverable 6 (Metabase
#         embed on ecommerce confirmation page).
#
# The agent produced cloudrun.yaml + deploy.sh in session 019, evaluator-
# cleared. This wrapper resolves the pinned Metabase image tag (the plan
# pins to v0.59.6.x — we pick the latest patch), runs the deploy with a
# dry-run preview + confirmation prompt, then verifies the outcome.
#
# Usage: bash docs/manual/task-2026-04-17-001.sh
#        bash docs/manual/task-2026-04-17-001.sh --skip-confirm   # for CI
# ═══════════════════════════════════════════════════════
set -euo pipefail

# ── User Configuration ───────────────────────────────
PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-metabase}"
# Major.minor pinned by the deployment plan. Change ONLY if the plan
# changes — and then update cloudrun.yaml + README together.
METABASE_MAJOR_MINOR="v0.59.6"
# Override by exporting METABASE_IMAGE before running — skips auto-resolution.
FORCE_IMAGE="${METABASE_IMAGE:-}"

SKIP_CONFIRM=false
if [[ "${1:-}" == "--skip-confirm" ]]; then SKIP_CONFIRM=true; fi

SCRIPT_ROOT="$(cd "$(dirname "$0")/../../infrastructure/metabase" && pwd)"
LOG=/tmp/metabase-task3-$(date +%Y%m%d-%H%M%S).log

# ── Prerequisites ────────────────────────────────────
check() { command -v "$1" >/dev/null 2>&1 || { echo "❌ $1 required but not found"; exit 1; }; }
check gcloud
check curl
check jq

gcloud config get-value account >/dev/null 2>&1 \
  || { echo "❌ gcloud not authenticated. Run: gcloud auth login"; exit 1; }

CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [[ "${CURRENT_PROJECT}" != "${PROJECT}" ]]; then
  echo "❌ gcloud project is '${CURRENT_PROJECT}', expected '${PROJECT}'"
  echo "   Run: gcloud config set project ${PROJECT}"
  exit 1
fi

# compute.googleapis.com must be enabled — Direct VPC egress depends on it.
if ! gcloud services list --enabled --project="${PROJECT}" \
     --filter="config.name=compute.googleapis.com" --format="value(config.name)" \
     | grep -q compute; then
  echo "❌ compute.googleapis.com not enabled. Enabling now..."
  gcloud services enable compute.googleapis.com --project="${PROJECT}"
fi
if ! gcloud services list --enabled --project="${PROJECT}" \
     --filter="config.name=run.googleapis.com" --format="value(config.name)" \
     | grep -q run; then
  echo "❌ run.googleapis.com not enabled. Enabling now..."
  gcloud services enable run.googleapis.com --project="${PROJECT}"
fi

# Tasks 1 & 2 artifacts — deploy.sh checks these too but fail early here
# for a better error surface.
gcloud sql instances describe metabase-app-db --project="${PROJECT}" >/dev/null 2>&1 \
  || { echo "❌ Cloud SQL instance metabase-app-db missing (run setup-cloudsql.sh — Task 1)"; exit 1; }
gcloud iam service-accounts describe "metabase-runtime@${PROJECT}.iam.gserviceaccount.com" \
  --project="${PROJECT}" >/dev/null 2>&1 \
  || { echo "❌ metabase-runtime service account missing (run setup-iam.sh — Task 2)"; exit 1; }

echo "✓ Prereqs OK"
echo ""

# ── Resolve pinned image tag ─────────────────────────
if [[ -n "${FORCE_IMAGE}" ]]; then
  RESOLVED_IMAGE="${FORCE_IMAGE}"
  echo "==> Using METABASE_IMAGE from environment: ${RESOLVED_IMAGE}"
else
  echo "==> Resolving latest ${METABASE_MAJOR_MINOR}.x tag from GitHub..."
  # Paginate up to 3 pages (300 releases) — Metabase releases often ship
  # multiple patch builds and 0.59.6 may be several pages back by now.
  RESOLVED_TAG=""
  for PAGE in 1 2 3; do
    CANDIDATE=$(curl -fsSL \
      "https://api.github.com/repos/metabase/metabase/releases?per_page=100&page=${PAGE}" 2>/dev/null \
      | jq -r '.[] | select(.prerelease==false and .draft==false) | .tag_name' \
      | grep -E "^${METABASE_MAJOR_MINOR}(\.[0-9]+)?$" \
      | sort -V | tail -1 || true)
    if [[ -n "${CANDIDATE}" ]]; then RESOLVED_TAG="${CANDIDATE}"; break; fi
  done

  if [[ -z "${RESOLVED_TAG}" ]]; then
    echo "⚠  Could not auto-resolve a ${METABASE_MAJOR_MINOR}.x tag from GitHub."
    echo "   Check https://github.com/metabase/metabase/releases and set manually:"
    echo "     export METABASE_IMAGE=metabase/metabase:${METABASE_MAJOR_MINOR}"
    echo "   Then re-run this script."
    exit 1
  fi

  RESOLVED_IMAGE="metabase/metabase:${RESOLVED_TAG}"
  echo "   Resolved: ${RESOLVED_IMAGE}"
fi
echo ""

# ── Dry-run preview ──────────────────────────────────
echo "==> Dry-run preview (renders cloudrun.yaml; no changes applied)..."
echo ""
cd "${SCRIPT_ROOT}"
METABASE_IMAGE="${RESOLVED_IMAGE}" ./deploy.sh --dry-run 2>&1 | tee -a "${LOG}"
echo ""

# ── Confirmation ─────────────────────────────────────
if ! $SKIP_CONFIRM; then
  echo "═══════════════════════════════════════════════════════"
  echo "About to deploy: ${RESOLVED_IMAGE}"
  echo "Target: ${PROJECT}/${REGION}/${SERVICE_NAME}"
  echo "Log:    ${LOG}"
  echo "═══════════════════════════════════════════════════════"
  read -r -p "Proceed? [y/N] " ANS </dev/tty
  [[ "${ANS:-}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# ── Deploy ───────────────────────────────────────────
echo ""
echo "==> Deploying..."
METABASE_IMAGE="${RESOLVED_IMAGE}" ./deploy.sh 2>&1 | tee -a "${LOG}"
echo ""

# ── Verification ─────────────────────────────────────
echo ""
echo "═══ Verification ═══"

PASS=0; FAIL=0
verify() {
  local cmd="$1" label="$2"
  if eval "${cmd}" >/dev/null 2>&1; then
    echo "  ✓ ${label}"; PASS=$((PASS+1))
  else
    echo "  ✗ ${label}"; FAIL=$((FAIL+1))
  fi
}

READY=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT}" \
  --format='value(status.conditions[0].status)' 2>/dev/null || echo "unknown")
DEPLOYED_IMAGE=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT}" \
  --format='value(spec.template.spec.containers[0].image)' 2>/dev/null || echo "unknown")
URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT}" \
  --format='value(status.url)' 2>/dev/null || echo "")
INGRESS=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT}" \
  --format='value(metadata.annotations."run.googleapis.com/ingress")' 2>/dev/null || echo "")

verify "[[ '${READY}' == 'True' ]]"                             "Service Ready=True (got: ${READY})"
verify "[[ '${DEPLOYED_IMAGE}' == '${RESOLVED_IMAGE}' ]]"       "Deployed image matches target (got: ${DEPLOYED_IMAGE})"
verify "[[ -n '${URL}' ]]"                                      ".run.app URL assigned (got: ${URL})"
verify "[[ '${INGRESS}' == 'internal-and-cloud-load-balancing' ]]" "Ingress locked to LB (got: ${INGRESS})"

# Direct .run.app access should be refused — any non-2xx is acceptable.
# A 2xx here would mean ingress is wrong and the service is exposed.
if [[ -n "${URL}" ]]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${URL}/api/health" || echo "000")
  if [[ "${CODE}" =~ ^(403|404)$ ]] || [[ "${CODE}" == "000" ]]; then
    echo "  ✓ .run.app direct access blocked (got: ${CODE})"
    PASS=$((PASS+1))
  elif [[ "${CODE}" =~ ^2 ]]; then
    echo "  ✗ .run.app returned ${CODE} — ingress lock leaked! Service is exposed."
    FAIL=$((FAIL+1))
  else
    echo "  ✓ .run.app direct access returned ${CODE} (non-2xx, acceptable)"
    PASS=$((PASS+1))
  fi
fi

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "Log:     ${LOG}"
echo ""

if [[ "${FAIL}" -eq 0 ]]; then
  cat <<EOF
═══════════════════════════════════════════════════════
✓ Task 3 complete. Record these values for the session handoff:

  Deployed image: ${RESOLVED_IMAGE}
  Cloud Run URL:  ${URL}
  Ready:          ${READY}
  Ingress:        ${INGRESS}

Next:
  1. Update task-2026-04-17-001.sh status in your handoff notes to 'done'.
  2. Record the pinned image tag in infrastructure/metabase/.env.example
     (or a future VERSIONS.md) — product reviewer flagged this as a Minor
     gap in session 019.
  3. Proceed to Task 5 — see docs/manual/task-2026-04-17-002.md.
═══════════════════════════════════════════════════════
EOF
  exit 0
else
  cat <<EOF
═══════════════════════════════════════════════════════
✗ Task 3 has failures. Common causes (check ${LOG} for specifics):

  - Permission: grant roles/iam.serviceAccountUser on metabase-runtime
    to your account:
      gcloud iam service-accounts add-iam-policy-binding \\
        metabase-runtime@${PROJECT}.iam.gserviceaccount.com \\
        --project=${PROJECT} \\
        --member="user:\$(gcloud config get-value account)" \\
        --role="roles/iam.serviceAccountUser"
  - Cold start: first deploy takes 60-120s for the container to pass the
    startup probe. If 'Ready=Unknown', wait 2 min and re-run the describe
    command from verify step above.
  - Ingress drift: if Ingress != 'internal-and-cloud-load-balancing',
    something external edited the service. Re-run deploy.sh (it applies
    the full spec from cloudrun.yaml).

Update task status to 'blocked' with notes on what failed.
═══════════════════════════════════════════════════════
EOF
  exit 1
fi
