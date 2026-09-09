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

# Create the table, or reconcile an existing one onto the committed schema.
#
# This used to print "already exists, skipping" and stop, so every column added
# to schema.json after the table was created was committed and never applied.
# Measured 2026-09-09: the live table had 50 columns against 77 declared, and
# the 27 missing ones were the entire payload of the Claudish, Web Vitals and
# engagement events. The sGTM BigQuery tag writes fullEventData and BigQuery
# silently discards fields with no matching column, so those events landed
# present by event_name and empty of every measurement worth collecting.
#
# `bq update --schema` is additive and safe on a populated table: it adds
# NULLABLE columns without a rewrite and without touching existing rows. It
# cannot drop or retype a column, which is the property that makes running this
# on every deploy reasonable rather than frightening.
if bq --project_id="${PROJECT}" show "${DATASET}.${TABLE}" > /dev/null 2>&1; then
  BEFORE=$(bq --project_id="${PROJECT}" show --schema "${DATASET}.${TABLE}" | tr ',' '\n' | grep -c '"name"')
  DECLARED=$(grep -c '"name"' "${SCHEMA_FILE}")
  echo "Table ${DATASET}.${TABLE} exists with ${BEFORE} columns; schema.json declares ${DECLARED}."
  if [ "${BEFORE}" -eq "${DECLARED}" ]; then
    echo "Schema already matches, nothing to reconcile."
  else
    echo "Reconciling schema (additive; existing rows untouched)..."
    bq --project_id="${PROJECT}" update \
      --schema="${SCHEMA_FILE}" \
      "${PROJECT}:${DATASET}.${TABLE}"
    AFTER=$(bq --project_id="${PROJECT}" show --schema "${DATASET}.${TABLE}" | tr ',' '\n' | grep -c '"name"')
    echo "Schema reconciled: ${BEFORE} -> ${AFTER} columns."
    if [ "${AFTER}" -ne "${DECLARED}" ]; then
      echo "WARNING: table has ${AFTER} columns but schema.json declares ${DECLARED}." >&2
      echo "         A column may have been dropped from schema.json — bq update cannot remove columns." >&2
      exit 1
    fi
  fi
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
