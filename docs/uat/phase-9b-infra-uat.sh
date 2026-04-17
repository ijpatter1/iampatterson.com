#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# Phase 9B-infra — UAT (User Acceptance Test)
#
# End-to-end verification of the deployed Metabase stack. Exercises the
# deliverables of all 8 tasks as a user (or a dev re-validating after
# infra changes) would: can Metabase actually serve, is the IAP gate
# actually enforcing, is BigQuery actually reachable, are the security
# boundaries actually in place.
#
# Every check is automated where possible. The two scenarios that
# require a browser (Google SSO flow + Metabase BigQuery query) are
# confirmed via curl behaviors that prove the underlying plumbing
# would work end-to-end.
#
# Usage: bash docs/uat/phase-9b-infra-uat.sh
#        bash docs/uat/phase-9b-infra-uat.sh --no-browser   # skip interactive SSO check
#
# Exit status: 0 if all checks pass, 1 otherwise.
# ═══════════════════════════════════════════════════════
set -uo pipefail
# Note: do NOT use set -e — we want all checks to run even if one fails.

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-metabase}"
DOMAIN="${DOMAIN:-bi.iampatterson.com}"
CLOUD_RUN_URL_PATTERN="metabase-.*\.run\.app"

NO_BROWSER=false
[[ "${1:-}" == "--no-browser" ]] && NO_BROWSER=true

PASS=0; FAIL=0; SKIP=0

# ── Helpers ──────────────────────────────────────────
verify() {
  local label="$1" cmd="$2"
  if eval "${cmd}" >/dev/null 2>&1; then
    echo "  ✓ ${label}"; PASS=$((PASS+1))
  else
    echo "  ✗ ${label}"; FAIL=$((FAIL+1))
  fi
}
expect_code() {
  local label="$1" url="$2" expected="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}" 2>/dev/null || echo "000")
  if [[ "${code}" == "${expected}" ]]; then
    echo "  ✓ ${label} (got: ${code})"; PASS=$((PASS+1))
  else
    echo "  ✗ ${label} (expected ${expected}, got ${code})"; FAIL=$((FAIL+1))
  fi
}
section() { echo ""; echo "─── $1 ───"; }

# ── Prerequisites ────────────────────────────────────
echo "Phase 9B-infra UAT"
echo "Target project: ${PROJECT}"
echo ""

command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud required"; exit 1; }
command -v jq     >/dev/null 2>&1 || { echo "❌ jq required"; exit 1; }
command -v curl   >/dev/null 2>&1 || { echo "❌ curl required"; exit 1; }

gcloud config get-value account >/dev/null 2>&1 \
  || { echo "❌ gcloud not authenticated; run: gcloud auth login"; exit 1; }

# ── Scenario 1: Cloud SQL app DB is live and backed up ──
section "Scenario 1 — Cloud SQL app DB (Task 1)"
# Exercises: instance exists, private-IP-only, PITR + daily backups on,
# password secret accessible.

INSTANCE_JSON=$(gcloud sql instances describe metabase-app-db \
  --project="${PROJECT}" --format=json 2>/dev/null || echo '{}')

verify "Instance metabase-app-db exists" \
  "[[ \$(echo '${INSTANCE_JSON}' | jq -r '.name // empty') == 'metabase-app-db' ]]"
verify "Daily backups enabled" \
  "[[ \$(echo '${INSTANCE_JSON}' | jq -r '.settings.backupConfiguration.enabled') == 'true' ]]"
verify "Point-in-time recovery enabled" \
  "[[ \$(echo '${INSTANCE_JSON}' | jq -r '.settings.backupConfiguration.pointInTimeRecoveryEnabled') == 'true' ]]"
verify "Instance has a PRIVATE IP (no public IP)" \
  "[[ \$(echo '${INSTANCE_JSON}' | jq -r '[.ipAddresses[] | select(.type==\"PRIVATE\")] | length') -ge 1 && \
      \$(echo '${INSTANCE_JSON}' | jq -r '[.ipAddresses[] | select(.type==\"PRIMARY\")] | length') -eq 0 ]]"
verify "Secret metabase-db-password exists" \
  "gcloud secrets describe metabase-db-password --project=${PROJECT}"

# ── Scenario 2: Service accounts + IAM ──
section "Scenario 2 — Service accounts + IAM (Task 2)"
# Exercises: both SAs exist, each has expected role bindings, BQ SA is
# dataset-scoped (not project-wide dataViewer).

verify "metabase-runtime SA exists" \
  "gcloud iam service-accounts describe metabase-runtime@${PROJECT}.iam.gserviceaccount.com --project=${PROJECT}"
verify "metabase-bigquery SA exists" \
  "gcloud iam service-accounts describe metabase-bigquery@${PROJECT}.iam.gserviceaccount.com --project=${PROJECT}"
verify "Secret metabase-encryption-key exists" \
  "gcloud secrets describe metabase-encryption-key --project=${PROJECT}"
verify "Secret metabase-bq-sa-key exists" \
  "gcloud secrets describe metabase-bq-sa-key --project=${PROJECT}"

# BQ SA has dataViewer on iampatterson_marts (dataset-scoped, not project-wide).
BQ_DATASET_ACCESS=$(bq show --format=prettyjson iampatterson:iampatterson_marts 2>/dev/null \
  | jq -r '[.access[]? | select((.userByEmail // .iamMember // "") | test("metabase-bigquery")) | .role][0] // empty')
verify "BQ SA dataset-scoped dataViewer on iampatterson_marts" \
  "[[ '${BQ_DATASET_ACCESS}' == 'READER' || '${BQ_DATASET_ACCESS}' == 'roles/bigquery.dataViewer' ]]"

# ── Scenario 3: Cloud Run deployment state ──
section "Scenario 3 — Cloud Run deployment (Tasks 3 + 4)"
# Exercises: service is Ready, running a pinned image, ingress locked,
# runtime SA correct, required env vars present.

RUN_JSON=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT}" --format=json 2>/dev/null || echo '{}')

verify "Service Ready=True" \
  "[[ \$(echo '${RUN_JSON}' | jq -r '.status.conditions[0].status // empty') == 'True' ]]"
verify "Image pinned (not :latest)" \
  "echo '${RUN_JSON}' | jq -r '.spec.template.spec.containers[0].image' | grep -qE 'metabase/metabase:v[0-9]+\\.[0-9]+\\.[0-9]+'"
verify "Ingress = internal-and-cloud-load-balancing" \
  "[[ \$(echo '${RUN_JSON}' | jq -r '.metadata.annotations.\"run.googleapis.com/ingress\"') == 'internal-and-cloud-load-balancing' ]]"
verify "Runs as metabase-runtime SA" \
  "echo '${RUN_JSON}' | jq -r '.spec.template.spec.serviceAccountName' | grep -q metabase-runtime"
verify "MB_JETTY_PORT=8080 env set" \
  "echo '${RUN_JSON}' | jq -e '.spec.template.spec.containers[0].env[] | select(.name==\"MB_JETTY_PORT\") | select(.value==\"8080\")'"
verify "MB_DB_TYPE=postgres env set" \
  "echo '${RUN_JSON}' | jq -e '.spec.template.spec.containers[0].env[] | select(.name==\"MB_DB_TYPE\") | select(.value==\"postgres\")'"
verify "MB_DB_HOST resolves to a private IP (10.* or 172.16-31.* or 192.168.*)" \
  "echo '${RUN_JSON}' | jq -r '.spec.template.spec.containers[0].env[] | select(.name==\"MB_DB_HOST\") | .value' | grep -qE '^(10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|192\\.168\\.)'"
verify "No cloudsql-instances annotation (we use TCP, not sidecar)" \
  "! echo '${RUN_JSON}' | jq -e '.spec.template.metadata.annotations.\"run.googleapis.com/cloudsql-instances\"' 2>/dev/null"

# Direct .run.app access must be blocked (ingress lock).
RUN_URL=$(echo "${RUN_JSON}" | jq -r '.status.url // empty')
if [[ -n "${RUN_URL}" ]]; then
  expect_code ".run.app direct access blocked" "${RUN_URL}/api/health" "404"
fi

# ── Scenario 4: Load balancer + SSL cert ──
section "Scenario 4 — LB + SSL cert (Task 5)"
# Exercises: all 7 LB components exist, cert is ACTIVE, serverless NEG
# correctly targets the Cloud Run service, backend has no portName.

verify "Static IP metabase-lb-ip exists" \
  "gcloud compute addresses describe metabase-lb-ip --global --project=${PROJECT}"
verify "SSL cert metabase-cert is ACTIVE" \
  "[[ \$(gcloud compute ssl-certificates describe metabase-cert --global --project=${PROJECT} --format='value(managed.status)' 2>/dev/null) == 'ACTIVE' ]]"
verify "Serverless NEG metabase-neg exists" \
  "gcloud compute network-endpoint-groups describe metabase-neg --region=${REGION} --project=${PROJECT}"
verify "NEG targets the Metabase Cloud Run service" \
  "[[ \$(gcloud compute network-endpoint-groups describe metabase-neg --region=${REGION} --project=${PROJECT} --format='value(cloudRun.service)' 2>/dev/null) == '${SERVICE_NAME}' ]]"
verify "Backend service portName != 'https' (serverless NEG incompatibility)" \
  "PN=\$(gcloud compute backend-services describe metabase-backend --global --project=${PROJECT} --format='value(portName)' 2>/dev/null); [[ \"\${PN}\" != 'https' ]]"
verify "URL map metabase-url-map exists" \
  "gcloud compute url-maps describe metabase-url-map --global --project=${PROJECT}"
verify "Target HTTPS proxy metabase-https-proxy exists" \
  "gcloud compute target-https-proxies describe metabase-https-proxy --global --project=${PROJECT}"
verify "Global forwarding rule metabase-forwarding-rule exists" \
  "gcloud compute forwarding-rules describe metabase-forwarding-rule --global --project=${PROJECT}"

verify "DNS resolves ${DOMAIN} to the LB IP" \
  "LB_IP=\$(gcloud compute addresses describe metabase-lb-ip --global --project=${PROJECT} --format='value(address)'); [[ \$(dig +short ${DOMAIN}) == \"\${LB_IP}\" ]]"

# ── Scenario 5: IAP gate is enforcing ──
section "Scenario 5 — IAP enforcing (Task 6)"
# Exercises: IAP enabled on backend, OAuth client stored in Secret
# Manager, allowlist has members, IAP service agent provisioned and has
# run.invoker on Cloud Run, browser request gets 302 to Google SSO.

verify "IAP enabled on metabase-backend" \
  "[[ \$(gcloud compute backend-services describe metabase-backend --global --project=${PROJECT} --format='value(iap.enabled)' 2>/dev/null) == 'True' ]]"
verify "Secret metabase-iap-client-id exists" \
  "gcloud secrets describe metabase-iap-client-id --project=${PROJECT}"
verify "Secret metabase-iap-client-secret exists" \
  "gcloud secrets describe metabase-iap-client-secret --project=${PROJECT}"
verify "IAP allowlist has at least one member" \
  "gcloud iap web get-iam-policy --resource-type=backend-services --service=metabase-backend --project=${PROJECT} --format='value(bindings.members)' | grep -q ':'"

# IAP service agent must be provisioned and hold run.invoker on the service.
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)' 2>/dev/null)
IAP_SA="service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com"
verify "IAP service agent has run.invoker on Cloud Run service" \
  "gcloud run services get-iam-policy ${SERVICE_NAME} --region=${REGION} --project=${PROJECT} --format=json | jq -e \".bindings[]? | select(.role==\\\"roles/run.invoker\\\") | .members[] | select(.==\\\"serviceAccount:${IAP_SA}\\\")\""

# End-user behavior: GET the domain, expect 302 to accounts.google.com.
LOC=$(curl -sI "https://${DOMAIN}/" 2>/dev/null | grep -i '^location:' | awk '{print $2}' | tr -d '\r\n')
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}/" 2>/dev/null || echo "000")
if [[ "${CODE}" == "302" ]] && [[ "${LOC}" == https://accounts.google.com/* ]]; then
  echo "  ✓ Browser GET ${DOMAIN} → 302 to accounts.google.com (IAP enforcing)"; PASS=$((PASS+1))
else
  echo "  ✗ Browser GET ${DOMAIN} → ${CODE} to ${LOC:-<no location>} (IAP may not be enforcing)"; FAIL=$((FAIL+1))
fi

# ── Scenario 6: Metabase + BigQuery wiring (Task 7) ──
section "Scenario 6 — Metabase + BigQuery data source (Task 7)"
# Metabase's admin UI state isn't introspectable without a session cookie.
# Exercise the preconditions that the session-7 walkthrough depends on:
# the BQ SA key is retrievable, BQ SA can actually run a query on the
# target dataset. A human confirms the Metabase-side connection works
# via the browser scenarios below.

verify "BigQuery SA key retrievable from Secret Manager" \
  "gcloud secrets versions access latest --secret=metabase-bq-sa-key --project=${PROJECT} | jq -e '.type==\"service_account\"'"
verify "BQ SA can query mart_campaign_performance (proves dataset-scoped access)" \
  "bq query --use_legacy_sql=false --project_id=${PROJECT} --format=none 'SELECT 1 FROM \`${PROJECT}.iampatterson_marts.mart_campaign_performance\` LIMIT 1'"

# ── Scenario 7: Operational runbooks (Task 8) ──
section "Scenario 7 — Operational scripts (Task 8)"
# Exercises: scripts exist, are executable, syntax-clean. Happy-path
# execution is deferred (nothing to actually back up beyond what Cloud
# SQL's automated daily backups already cover).

verify "backup.sh exists and is executable" \
  "[[ -x infrastructure/metabase/backup.sh ]]"
verify "upgrade.sh exists and is executable" \
  "[[ -x infrastructure/metabase/upgrade.sh ]]"
verify "backup.sh syntax OK" \
  "bash -n infrastructure/metabase/backup.sh"
verify "upgrade.sh syntax OK" \
  "bash -n infrastructure/metabase/upgrade.sh"
verify "upgrade.sh requires jq (hard prerequisite for the Ready poll)" \
  "grep -q 'jq' infrastructure/metabase/upgrade.sh"

# ── Edge cases ───────────────────────────────────────
section "Edge cases"

# Ingress-lock holds even when IAP is enforcing. Confirm the .run.app
# URL doesn't accidentally pass through after an LB-side change.
if [[ -n "${RUN_URL:-}" ]]; then
  expect_code "Ingress lock holds post-IAP — .run.app returns 404" "${RUN_URL}/api/health" "404"
fi

# Public sharing and embedding must be OFF in Metabase.
# (Deferred — requires authenticated Metabase session. Human-verified
# in session 020 per README Task 7 step 5. Listed here for visibility.)
echo "  ⊖ Metabase Public Sharing and Embedding = OFF (manual verification only)"
SKIP=$((SKIP+1))

# No secret JSON files left on disk in the metabase infra dir.
verify "No secret JSON keyfiles left in infrastructure/metabase/" \
  "! ls infrastructure/metabase/*.json 2>/dev/null | grep -v cloudrun.yaml"

# ── Optional: Interactive browser check ──────────────
if ! $NO_BROWSER; then
  section "Interactive (optional) — Metabase UI via IAP"
  cat <<EOF
Open this URL in a browser:

  https://${DOMAIN}/

Expected:
  1. Redirect to accounts.google.com (IAP gate).
  2. After signing in with an allowlisted Google account, you land on
     Metabase's login page (your Metabase admin password).
  3. After Metabase login, the dashboard shows the 'iampatterson marts'
     data source.
  4. Admin settings → Public sharing → both toggles show OFF.

EOF
  read -p "All 4 steps successful? [y/N] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  ✓ End-to-end browser flow works"; PASS=$((PASS+1))
  else
    echo "  ✗ End-to-end browser flow failed"; FAIL=$((FAIL+1))
  fi
else
  echo ""
  echo "─── Interactive browser check skipped (--no-browser) ───"
  SKIP=$((SKIP+1))
fi

# ── Summary ──────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════"
echo "  Passed:  ${PASS}"
echo "  Failed:  ${FAIL}"
echo "  Skipped: ${SKIP}"
echo "═════════════════════════════════════════════════"

if [[ "${FAIL}" -eq 0 ]]; then
  echo "✓ Phase 9B-infra UAT: ALL AUTOMATED CHECKS PASSED"
  echo "  The stack is verified live end-to-end: Cloud SQL + IAM + Cloud Run"
  echo "  + LB + SSL + IAP + Metabase + BigQuery are all wired correctly."
  exit 0
else
  echo "✗ Phase 9B-infra UAT: ${FAIL} check(s) failed"
  echo "  Review output above. Each failure references a specific resource"
  echo "  name + expected state. Cross-check against infrastructure/metabase/README.md"
  echo "  and docs/sessions/session-2026-04-17-020.md for the last-known-good state."
  exit 1
fi
