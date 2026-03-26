#!/usr/bin/env bash
#
# Creates the BigQuery dataset and events_raw table for iampatterson.com.
# Idempotent — safe to run multiple times.
#
# Prerequisites:
#   - gcloud CLI authenticated with BigQuery permissions
#   - GCP project set (gcloud config set project iampatterson)
#
# Usage:
#   ./infrastructure/bigquery/setup.sh
#   PROJECT=my-project LOCATION=US ./infrastructure/bigquery/setup.sh

set -euo pipefail

PROJECT="${PROJECT:-iampatterson}"
LOCATION="${LOCATION:-US}"
DATASET="iampatterson_raw"
TABLE="events_raw"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMA_FILE="${SCRIPT_DIR}/schema.json"

echo "==> Project:  ${PROJECT}"
echo "==> Location: ${LOCATION}"
echo "==> Dataset:  ${DATASET}"
echo "==> Table:    ${TABLE}"
echo ""

# Create dataset if it doesn't exist
if bq --project_id="${PROJECT}" show "${DATASET}" > /dev/null 2>&1; then
  echo "Dataset ${DATASET} already exists, skipping."
else
  echo "Creating dataset ${DATASET}..."
  bq --project_id="${PROJECT}" mk \
    --dataset \
    --location="${LOCATION}" \
    --description="Raw event stream from sGTM for iampatterson.com" \
    "${PROJECT}:${DATASET}"
  echo "Dataset created."
fi

# Create table if it doesn't exist
if bq --project_id="${PROJECT}" show "${DATASET}.${TABLE}" > /dev/null 2>&1; then
  echo "Table ${DATASET}.${TABLE} already exists, skipping."
else
  echo "Creating table ${DATASET}.${TABLE}..."
  bq --project_id="${PROJECT}" mk \
    --table \
    --schema="${SCHEMA_FILE}" \
    --time_partitioning_type="DAY" \
    --clustering_fields="event_name,session_id" \
    --description="Raw event data from sGTM — ingestion-time partitioned, clustered by event_name and session_id" \
    "${PROJECT}:${DATASET}.${TABLE}"
  echo "Table created."
fi

echo ""
echo "==> Done. Verify with:"
echo "    bq show --schema --format=prettyjson ${PROJECT}:${DATASET}.${TABLE}"
