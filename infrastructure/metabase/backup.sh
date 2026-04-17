#!/usr/bin/env bash
#
# Task 8 — On-demand Cloud SQL backup for the Metabase app DB.
# See docs/input_artifacts/metabase-deployment-plan.md (Task 8) for spec.
#
# Daily automated backups are already configured on the Cloud SQL
# instance (Task 1, 7-day retention). This script adds ad-hoc backups
# tagged with the current timestamp and the deployed Metabase image tag.
# Run it before every upgrade (upgrade.sh runs it automatically).
#
# Prerequisites:
#   - Task 1 complete: Cloud SQL instance metabase-app-db exists.
#   - IAM on executing principal: roles/cloudsql.admin or
#     roles/cloudsql.editor.
#
# Usage:
#   ./backup.sh
#   ./backup.sh --dry-run
#
# Output:
#   On success: prints the backup ID for the upgrade runbook to
#   reference. Exit 0.

set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
INSTANCE="${INSTANCE:-metabase-app-db}"
SERVICE_NAME="${SERVICE_NAME:-metabase}"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=true; fi

# Precondition: Cloud SQL instance exists. Matches the pattern used
# across setup-iam.sh / deploy.sh / setup-domain.sh / setup-iap.sh.
if ! gcloud sql instances describe "${INSTANCE}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "ERROR: Cloud SQL instance '${INSTANCE}' not found. Task 1 must run first."
  exit 1
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)

# Fetch the currently deployed Metabase image tag so the backup
# description records the exact version the app DB schema belongs to.
# If the Cloud Run service doesn't exist yet (very first deploy), fall
# back to "unknown".
if gcloud run services describe "${SERVICE_NAME}" \
     --region="${REGION}" --project="${PROJECT}" >/dev/null 2>&1; then
  DEPLOYED_IMAGE=$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" --project="${PROJECT}" \
    --format="value(spec.template.spec.containers[0].image)" 2>/dev/null || echo "unknown")
else
  DEPLOYED_IMAGE="unknown"
fi

DESCRIPTION="metabase ${DEPLOYED_IMAGE##*:} @ ${TS}"

echo "==> Project:     ${PROJECT}"
echo "==> Instance:    ${INSTANCE}"
echo "==> Description: ${DESCRIPTION}"
if $DRY_RUN; then echo "==> DRY-RUN mode: no backup will be taken"; fi
echo ""

if $DRY_RUN; then
  echo "+ gcloud sql backups create --instance=${INSTANCE} --description='${DESCRIPTION}'"
  echo ""
  echo "(dry-run) skipping actual backup."
  exit 0
fi

echo "==> Creating on-demand backup (1-3 minutes)..."
gcloud sql backups create \
  --instance="${INSTANCE}" \
  --description="${DESCRIPTION}" \
  --project="${PROJECT}"

# Find the backup we just created (most recent, matching description).
# Cloud SQL doesn't emit the backup ID on `backups create` directly,
# so we list post-create.
BACKUP_ID=$(gcloud sql backups list \
  --instance="${INSTANCE}" \
  --project="${PROJECT}" \
  --filter="description='${DESCRIPTION}'" \
  --sort-by="~windowStartTime" \
  --limit=1 \
  --format="value(id)" 2>/dev/null || echo "")

if [[ -z "${BACKUP_ID}" ]]; then
  echo "WARNING: Could not identify the newly created backup ID."
  echo "         List manually: gcloud sql backups list --instance=${INSTANCE}"
  exit 0
fi

echo ""
echo "==> Backup complete."
echo "    Backup ID:   ${BACKUP_ID}"
echo "    Description: ${DESCRIPTION}"
echo ""
echo "Restore (on-demand, requires downtime — instance is stopped during"
echo "restore and all currently-connected sessions drop):"
echo "  gcloud sql backups restore ${BACKUP_ID} \\"
echo "    --restore-instance=${INSTANCE} --project=${PROJECT}"
