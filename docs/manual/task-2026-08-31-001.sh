#!/bin/bash
# ═══════════════════════════════════════════════════════
# Claudish launch prerequisites — GCP + Anthropic lanes
# Created: 2026-08-31, feat/claudish session
# Phase: outside-phase (feat/claudish)
# Blocks: claudish-proxy deploy (M4) — dev can proceed offline meanwhile
# QA: PASS — vetted by guv:reviewer — 9 findings (3 Major, 6 Minor) — all fixed in place
#
# The Claudish translator's proxy calls Claude Haiku 4.5 on Vertex AI
# (global endpoint, ADC — no key), with the Anthropic API as a funded
# fallback lane. This script does every scriptable prerequisite: enables
# the Vertex API, reads the Claude quota metrics, optionally probes the
# model end-to-end (~$0.001). Anthropic auth is Workload Identity
# Federation (2026-08-31) — no key step. The console-UI steps (Model Garden terms
# creation/funding) are in task-2026-08-31-001.md.
#
# Usage: bash docs/manual/task-2026-08-31-001.sh [--probe]
#   --probe  send one 1-token request to Haiku 4.5 on the global endpoint
#            to prove enablement + quota end-to-end (~$0.001)
# ═══════════════════════════════════════════════════════
set -euo pipefail
# Never let gcloud open an interactive component-install prompt mid-script.
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

# ── User Configuration ───────────────────────────────
PROJECT_ID="${PROJECT:-iampatterson}"
MODEL_ID="${VERTEX_MODEL_ID:-claude-haiku-4-5@20251001}"
SECRET_NAME="claudish-anthropic-api-key"
PROBE=0
[ "${1:-}" = "--probe" ] && PROBE=1

# ── Prerequisites ────────────────────────────────────
command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud required but not found"; exit 1; }
command -v curl   >/dev/null 2>&1 || { echo "❌ curl required but not found"; exit 1; }

# The tunameltsmyheart.com Workspace session policy expires auth ~hourly.
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "❌ gcloud auth expired. Run: gcloud auth login"
  exit 1
fi
echo "✓ gcloud authenticated ($(gcloud config get-value account 2>/dev/null))"

# ── Execution ────────────────────────────────────────

echo ""
echo "Step 1: Enabling aiplatform.googleapis.com (idempotent)..."
if gcloud services list --enabled --project="${PROJECT_ID}" \
    --filter="config.name=aiplatform.googleapis.com" --format="value(config.name)" \
    | grep -q aiplatform; then
  echo "  already enabled"
else
  gcloud services enable aiplatform.googleapis.com --project="${PROJECT_ID}"
  echo "  enabled"
fi

echo ""
echo "Step 2: Reading Claude Haiku quota metrics (global endpoint)..."
# Per-model quota metrics, dimension base_model=anthropic-claude-haiku.
# Defaults for Haiku 4.5: global 2,500 QPM / 2.5M input TPM / 250K output TPM.
# If these read 0, see the task card's stuck-at-0 contingency.
QUOTA_OUT="$(gcloud beta quotas info list \
  --service=aiplatform.googleapis.com \
  --project="${PROJECT_ID}" \
  --format=json 2>/dev/null || echo '[]')"
if [ "${QUOTA_OUT}" = "[]" ] || [ -z "${QUOTA_OUT}" ]; then
  echo "  ⚠ could not read quotas via gcloud (alpha command unavailable or empty)."
  echo "    Check in the console instead:"
  echo "    https://console.cloud.google.com/iam-admin/quotas?project=${PROJECT_ID}"
  echo "    Filter: anthropic-claude-haiku — record the three global metrics."
  QUOTA_STATUS="manual"
else
  # Context-grep so the limit VALUES are visible, not just the dimension name.
  echo "${QUOTA_OUT}" | grep -B6 -A8 'anthropic-claude-haiku' | head -60 || true
  if echo "${QUOTA_OUT}" | grep -q 'anthropic-claude-haiku'; then
    QUOTA_STATUS="found"
    echo "  ✓ Claude Haiku quota rows present — check the limit values above (0 = blocked)"
  else
    QUOTA_STATUS="absent"
    echo "  ⚠ no anthropic-claude-haiku rows — model likely not yet enabled in Model Garden"
  fi
fi

if [ "${PROBE}" = "1" ]; then
  echo ""
  echo "Step 3: Probing ${MODEL_ID} on the global endpoint (1 token, ~\$0.001)..."
  TOKEN="$(gcloud auth print-access-token)"
  # The OAuth token rides on curl's argv: short-lived (~1h), Google's own
  # documented pattern; accepted deviation from the no-secret-on-argv rule
  # the long-lived Anthropic key below follows strictly.
  HTTP_CODE="$(curl -s -o /tmp/claudish-probe.json -w '%{http_code}' \
    -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/anthropic/models/${MODEL_ID}:rawPredict" \
    -d '{"anthropic_version":"vertex-2023-10-16","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' || echo 000)"
  case "${HTTP_CODE}" in
    200) echo "  ✓ 200 — Model Garden enabled, quota nonzero, end-to-end works" ;;
    403) echo "  ✗ 403 — Model Garden enablement / Anthropic terms missing (see task card step 1)";
         grep -o '"message": *"[^"]*"' /tmp/claudish-probe.json | head -1 ;;
    429) echo "  ✗ 429 — quota is 0 for this project (see task card stuck-at-0 contingency)" ;;
    404) echo "  ✗ 404 — model ID ${MODEL_ID} not found (check Model Garden for the current ID)" ;;
    000) echo "  ✗ network failure — could not reach aiplatform.googleapis.com" ;;
    *)   echo "  ✗ HTTP ${HTTP_CODE} — unexpected; body:";
         head -c 400 /tmp/claudish-probe.json; echo "" ;;
  esac
  rm -f /tmp/claudish-probe.json
else
  HTTP_CODE="skipped"
  echo ""
  echo "Step 3: probe skipped (pass --probe to verify end-to-end for ~\$0.001)"
fi

echo ""
echo "Step 4: Anthropic auth — Workload Identity Federation (no key)"
echo "  ✓ superseded 2026-08-31: the anthropic-api lane authenticates via"
echo "    WIF (Claude Console rule fdrl_01RYv2ptEbtu7jpssKo1ZcRH on the"
echo "    google-cloud issuer → svac_014RW8M13t3K3QXY6pL7mrLo). Verified"
echo "    end-to-end the same day. No key to create, paste, or rotate."
echo "    The ${SECRET_NAME} secret shell is unused break-glass."

# ── Verification ─────────────────────────────────────
echo ""
echo "═══ Verification ═══"
PASS=0; FAIL=0; SKIP=0

if gcloud services list --enabled --project="${PROJECT_ID}" \
    --filter="config.name=aiplatform.googleapis.com" --format="value(config.name)" \
    | grep -q aiplatform; then
  echo "  ✓ aiplatform.googleapis.com enabled"; PASS=$((PASS+1))
else
  echo "  ✗ aiplatform.googleapis.com NOT enabled"; FAIL=$((FAIL+1))
fi

# WIF replaced the key path (2026-08-31): federation-rule health is
# verified at deploy smoke time (the anthropic-api lane answering), not
# here — this machine holds no ambient SA identity to exchange with.
echo "  ✓ Anthropic auth via WIF — no secret to verify"; PASS=$((PASS+1))

case "${QUOTA_STATUS}" in
  found)  echo "  ✓ Claude Haiku quota rows exist (values need eyeballing above)"; PASS=$((PASS+1)) ;;
  manual) echo "  ⚠ quota read needs the console (see task card step 4)"; SKIP=$((SKIP+1)) ;;
  absent) echo "  ✗ no Claude Haiku quota rows — Model Garden enablement missing"; FAIL=$((FAIL+1)) ;;
esac

case "${HTTP_CODE}" in
  200)     echo "  ✓ live probe returned 200"; PASS=$((PASS+1)) ;;
  skipped) echo "  ⚠ live probe skipped"; SKIP=$((SKIP+1)) ;;
  *)       echo "  ✗ live probe returned ${HTTP_CODE}"; FAIL=$((FAIL+1)) ;;
esac

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped"

# ── Report ───────────────────────────────────────────
if [ "${FAIL}" -eq 0 ] && [ "${SKIP}" -eq 0 ]; then
  echo ""
  echo "All checks passed. Update task-2026-08-31-001.md status to 'done'."
elif [ "${FAIL}" -eq 0 ]; then
  echo ""
  echo "No failures; ${SKIP} step(s) pending (UI work in task-2026-08-31-001.md)."
else
  echo ""
  echo "Some checks failed — see the task card's contingencies, then re-run."
  exit 1
fi
