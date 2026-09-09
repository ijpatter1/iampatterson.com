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
TMP_LIVE="$(mktemp)"
trap 'rm -f "${TMP_LIVE}"' EXIT

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
  # Compare the two schemas properly, by (name, type, mode) — not by counting.
  #
  # The first version of this compared column COUNTS, which is not a
  # comparison: renaming a column, changing metric_value from FLOAT64 to
  # STRING, or deleting one column and adding another in the same edit all
  # leave the count unchanged, so the reconcile would short-circuit and the
  # payload would be silently dropped at the BigQuery write. That is the exact
  # defect this script exists to fix, reintroduced through the check chosen to
  # detect it. Caught by review before it shipped.
  #
  # Both sides are JSON and both are already being read, so diff them as JSON.
  bq --project_id="${PROJECT}" show --schema --format=json "${DATASET}.${TABLE}" > "${TMP_LIVE}"
  if DIFF=$(python3 "${SCRIPT_DIR}/schema-diff.py" "${TMP_LIVE}" "${SCHEMA_FILE}"); then
    echo "Table ${DATASET}.${TABLE}: schema already matches schema.json."
  else
    echo "Table ${DATASET}.${TABLE} differs from schema.json:"
    printf '%s\n' "${DIFF}"
    echo "Reconciling (additive; existing rows untouched)..."
    bq --project_id="${PROJECT}" update \
      --schema="${SCHEMA_FILE}" \
      "${PROJECT}:${DATASET}.${TABLE}"
    bq --project_id="${PROJECT}" show --schema --format=json "${DATASET}.${TABLE}" > "${TMP_LIVE}"
    if REMAINING=$(python3 "${SCRIPT_DIR}/schema-diff.py" "${TMP_LIVE}" "${SCHEMA_FILE}"); then
      echo "Schema reconciled; live table now matches schema.json."
    else
      echo "ERROR: schema still differs after update:" >&2
      printf '%s\n' "${REMAINING}" >&2
      echo "       bq update is additive — it cannot drop or retype a column." >&2
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
