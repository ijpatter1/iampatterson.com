#!/usr/bin/env bash
#
# Export mart datasets to GCS as parquet files for AI/ML consumption.
#
# Usage:
#   ./export.sh              # Export all mart tables
#   ./export.sh --table mart_session_events  # Export a single table
#
# Designed to be run manually or via Cloud Scheduler.

set -uo pipefail

PROJECT="iampatterson"
BUCKET="gs://${PROJECT}-ai-exports"
DATASET="iampatterson_marts"
EXPORT_DATE=$(date +%Y-%m-%d)
TARGET_TABLE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --table) TARGET_TABLE="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 [--table TABLE_NAME]"
      echo "  --table TABLE_NAME   Export a single table (default: all)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== BigQuery → GCS Parquet Export ==="
echo "Date:    ${EXPORT_DATE}"
echo "Bucket:  ${BUCKET}"
echo ""

# Get list of tables to export
if [[ -n "$TARGET_TABLE" ]]; then
  TABLES=("$TARGET_TABLE")
else
  TABLES=($(bq ls --format=json "${PROJECT}:${DATASET}" | \
    python3 -c "import sys,json; [print(t['tableReference']['tableId']) for t in json.load(sys.stdin)]" 2>/dev/null))
fi

TOTAL=0
FAILED=0

for TABLE in "${TABLES[@]}"; do
  echo "--- Exporting: ${TABLE} ---"
  DEST="${BUCKET}/${EXPORT_DATE}/${TABLE}/*.parquet"

  if bq extract \
    --destination_format=PARQUET \
    --compression=SNAPPY \
    "${PROJECT}:${DATASET}.${TABLE}" \
    "$DEST" 2>&1; then
    echo "  → ${DEST}"
    TOTAL=$((TOTAL + 1))
  else
    echo "  FAILED"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "========================================="
echo "  EXPORT COMPLETE"
echo "  Exported: ${TOTAL} tables"
echo "  Failed:   ${FAILED}"
echo "  Location: ${BUCKET}/${EXPORT_DATE}/"
echo "========================================="

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
