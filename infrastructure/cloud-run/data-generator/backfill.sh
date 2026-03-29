#!/usr/bin/env bash
#
# Run the historical backfill for business models.
#
# Usage:
#   ./backfill.sh                          # Full 18-month backfill (all models)
#   ./backfill.sh --months 1               # Shorter backfill for testing
#   ./backfill.sh --model ecommerce        # Backfill a single model
#   ./backfill.sh --model subscription --months 1
#   ./backfill.sh --dry-run                # Generate without sending to sGTM
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login)
#   - data-generator Cloud Run service deployed
#   - Your account has roles/run.invoker on the service

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MONTHS=18
DRY_RUN=false
SERVICE_NAME="data-generator"
REGION="us-central1"
SELECTED_MODEL=""
ALL_MODELS=("ecommerce" "subscription" "leadgen")

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --months)  MONTHS="$2"; shift 2 ;;
    --model)   SELECTED_MODEL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --help)
      echo "Usage: $0 [--months N] [--model MODEL] [--dry-run]"
      echo "  --months N       Number of months to backfill (default: 18)"
      echo "  --model MODEL    Run a single model: ecommerce, subscription, or leadgen"
      echo "  --dry-run        Generate events without sending to sGTM"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Validate and set models to run
if [[ -n "$SELECTED_MODEL" ]]; then
  if [[ ! " ${ALL_MODELS[*]} " =~ " ${SELECTED_MODEL} " ]]; then
    echo "ERROR: Unknown model '${SELECTED_MODEL}'. Valid: ${ALL_MODELS[*]}"
    exit 1
  fi
  MODELS=("$SELECTED_MODEL")
else
  MODELS=("${ALL_MODELS[@]}")
fi

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

echo "=== Data Generator Backfill ==="
echo "Months:  ${MONTHS}"
echo "Dry run: ${DRY_RUN}"
echo ""

# Get service URL
DATA_GEN_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" --format='value(status.url)' 2>/dev/null)

if [[ -z "$DATA_GEN_URL" ]]; then
  echo "ERROR: Could not find Cloud Run service '${SERVICE_NAME}' in ${REGION}"
  echo "Deploy the service first — see docs/DEPLOYMENT_PHASE4.md"
  exit 1
fi

echo "Service: ${DATA_GEN_URL}"

# Get auth token
AUTH_TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
if [[ -z "$AUTH_TOKEN" ]]; then
  echo "ERROR: Could not get identity token. Run: gcloud auth login"
  exit 1
fi

# Health check
echo ""
echo "--- Health check ---"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "${DATA_GEN_URL}/health")

if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "ERROR: Health check failed (HTTP ${HTTP_STATUS})"
  exit 1
fi
echo "OK"

# Check if already running
IS_RUNNING=$(curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "${DATA_GEN_URL}/stats" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isRunning', False))" 2>/dev/null)

if [[ "$IS_RUNNING" == "True" ]]; then
  echo "ERROR: A generation job is already running. Wait for it to finish or redeploy the service."
  exit 1
fi

# ---------------------------------------------------------------------------
# Run backfill
# ---------------------------------------------------------------------------

TOTAL_SENT=0
TOTAL_FAILED=0
TOTAL_EVENTS=0

for MODEL in "${MODELS[@]}"; do
  echo ""
  echo "=== Backfill: ${MODEL} (${MONTHS} months) ==="
  echo "Started at $(date '+%H:%M:%S')"

  RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    --max-time 3600 \
    "${DATA_GEN_URL}/backfill" \
    -d "{\"model\":\"${MODEL}\",\"months\":${MONTHS},\"dryRun\":${DRY_RUN}}")

  # Parse results
  SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [[ "$SUCCESS" != "True" ]]; then
    echo "FAILED!"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
    continue
  fi

  EVENTS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['stats']['totalEvents'])" 2>/dev/null || echo "?")
  SESSIONS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['stats']['totalSessions'])" 2>/dev/null || echo "?")
  AD_RECORDS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['stats']['totalAdRecords'])" 2>/dev/null || echo "?")
  DATE_START=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['stats']['dateRange']['start'])" 2>/dev/null || echo "?")
  DATE_END=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['stats']['dateRange']['end'])" 2>/dev/null || echo "?")

  if [[ "$DRY_RUN" == "false" ]]; then
    SENT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['sendResult']['sent'])" 2>/dev/null || echo "0")
    FAILED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['sendResult']['failed'])" 2>/dev/null || echo "0")
    TOTAL_SENT=$((TOTAL_SENT + SENT))
    TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  else
    SENT="(dry run)"
    FAILED="(dry run)"
  fi

  TOTAL_EVENTS=$((TOTAL_EVENTS + EVENTS))

  echo "  Date range: ${DATE_START} → ${DATE_END}"
  echo "  Sessions:   ${SESSIONS}"
  echo "  Events:     ${EVENTS}"
  echo "  Ad records: ${AD_RECORDS}"
  echo "  Sent:       ${SENT}"
  echo "  Failed:     ${FAILED}"
  echo "Finished at $(date '+%H:%M:%S')"
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "========================================="
echo "  BACKFILL COMPLETE"
echo "========================================="
echo "  Total events:  ${TOTAL_EVENTS}"
if [[ "$DRY_RUN" == "false" ]]; then
  echo "  Total sent:    ${TOTAL_SENT}"
  echo "  Total failed:  ${TOTAL_FAILED}"
fi
echo "========================================="

if [[ "$DRY_RUN" == "false" && "$TOTAL_FAILED" -gt 0 ]]; then
  echo ""
  echo "WARNING: ${TOTAL_FAILED} events failed to send."
  echo "Check logs: gcloud run services logs read data-generator --region=us-central1 --limit=50"
  exit 1
fi

if [[ "$DRY_RUN" == "false" ]]; then
  echo ""
  echo "Verify in BigQuery:"
  echo "  bq query --use_legacy_sql=false 'SELECT event_name, COUNT(*) as count FROM \`iampatterson.iampatterson_raw.events_raw\` GROUP BY event_name ORDER BY count DESC LIMIT 20'"
fi
