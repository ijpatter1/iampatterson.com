#!/usr/bin/env bash
#
# Task 8 — Orchestrated Metabase upgrade.
# See docs/input_artifacts/metabase-deployment-plan.md (Task 8) for spec.
#
# Flow:
#   1. Record current image tag (for rollback)
#   2. Run backup.sh (pre-upgrade app DB snapshot)
#   3. Print Metabase release notes URL and prompt for confirmation
#   4. Re-run deploy.sh with METABASE_IMAGE set to the target tag
#   5. Poll Cloud Run for the new revision to report Ready
#   6. Print verify + rollback instructions
#
# Prerequisites:
#   - Tasks 1-5 complete.
#   - Target version must match the deploy.sh pinned-semver regex
#     (v MAJOR.MINOR.PATCH[.BUILD]).
#
# Usage:
#   ./upgrade.sh v0.59.7
#   ./upgrade.sh v0.59.7 --dry-run
#   ./upgrade.sh v0.59.7 --skip-backup    # DANGEROUS — only if you just ran backup.sh

set -euo pipefail

if [[ $# -lt 1 || "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $0 <new-version-tag> [--dry-run] [--skip-backup]

Example: $0 v0.59.7
EOF
  exit 1
fi

TARGET_VERSION="$1"
shift || true

DRY_RUN=false
SKIP_BACKUP=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-backup) SKIP_BACKUP=true ;;
  esac
done

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-metabase}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ------------------------------------------------------------------------------
# Validate target version
# ------------------------------------------------------------------------------
TARGET_IMAGE="metabase/metabase:${TARGET_VERSION}"
if [[ ! "${TARGET_IMAGE}" =~ ^metabase/metabase:v[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  echo "ERROR: Target version '${TARGET_VERSION}' doesn't match the pinned-semver"
  echo "       pattern vMAJOR.MINOR.PATCH[.BUILD] (e.g. v0.59.7 or v0.59.7.1)."
  exit 1
fi

# ------------------------------------------------------------------------------
# Record current image for rollback
# ------------------------------------------------------------------------------
CURRENT_IMAGE=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT}" \
  --format="value(spec.template.spec.containers[0].image)" 2>/dev/null || echo "")

if [[ -z "${CURRENT_IMAGE}" ]]; then
  echo "ERROR: Could not read current Cloud Run image. Is Task 3 deployed?"
  exit 1
fi

echo "==> Current image: ${CURRENT_IMAGE}"
echo "==> Target image:  ${TARGET_IMAGE}"
if [[ "${CURRENT_IMAGE}" == "${TARGET_IMAGE}" ]]; then
  echo "==> Already on the target version. Nothing to do."
  exit 0
fi
if $DRY_RUN; then echo "==> DRY-RUN mode: no changes will be made"; fi
echo ""

# ------------------------------------------------------------------------------
# Backup first (unless explicitly skipped)
# ------------------------------------------------------------------------------
if ! $SKIP_BACKUP; then
  echo "==> Running backup.sh..."
  if $DRY_RUN; then
    "${SCRIPT_DIR}/backup.sh" --dry-run
  else
    "${SCRIPT_DIR}/backup.sh"
  fi
  echo ""
else
  # Guardrail: refuse --skip-backup if the most recent backup is older
  # than 24 hours, which almost always means the operator muscle-memoried
  # the flag rather than actually running backup.sh just now.
  echo "==> --skip-backup set; checking most recent backup freshness..."
  LATEST_BACKUP_TIME=$(gcloud sql backups list \
    --instance=metabase-app-db \
    --project="${PROJECT}" \
    --sort-by="~windowStartTime" \
    --limit=1 \
    --format="value(windowStartTime)" 2>/dev/null || echo "")

  if [[ -z "${LATEST_BACKUP_TIME}" ]]; then
    echo "ERROR: --skip-backup set but no backup found. Run backup.sh first"
    echo "       or drop the flag."
    exit 1
  fi

  # Portable epoch conversion (GNU date vs BSD date on macOS).
  if EPOCH=$(date -d "${LATEST_BACKUP_TIME}" +%s 2>/dev/null); then
    :
  elif EPOCH=$(date -jf "%Y-%m-%dT%H:%M:%S" "${LATEST_BACKUP_TIME%.*}" +%s 2>/dev/null); then
    :
  else
    echo "WARNING: Could not parse backup timestamp '${LATEST_BACKUP_TIME}'."
    echo "         Proceeding anyway — verify manually that a recent backup exists."
    EPOCH=$(date +%s)
  fi

  AGE=$(( $(date +%s) - EPOCH ))
  if (( AGE > 86400 )); then
    echo "ERROR: Most recent backup is $((AGE / 3600))h old (>24h). Refusing to skip."
    echo "       Drop --skip-backup or run backup.sh first."
    exit 1
  fi
  echo "Most recent backup: ${LATEST_BACKUP_TIME} ($((AGE / 60))m ago). Proceeding."
  echo ""
fi

# ------------------------------------------------------------------------------
# Confirm the operator has reviewed the release notes
# ------------------------------------------------------------------------------
RELEASE_NOTES_URL="https://github.com/metabase/metabase/releases/tag/${TARGET_VERSION}"
cat <<EOF
==> Review Metabase release notes before continuing:

    ${RELEASE_NOTES_URL}

    Look for: breaking schema changes, required env var changes,
    deprecation warnings, minimum supported Postgres version.

EOF

if $DRY_RUN; then
  echo "(dry-run) would prompt: 'Have you reviewed breaking changes? [y/N]'"
else
  printf 'Have you reviewed breaking changes? [y/N] '
  # Force interactive read even if stdin is redirected from the
  # parent context — upgrades must not proceed on piped input.
  read -r REPLY </dev/tty
  if [[ ! "${REPLY}" =~ ^[Yy]$ ]]; then
    echo "Aborting. Re-run when ready."
    exit 1
  fi
fi
echo ""

# ------------------------------------------------------------------------------
# Deploy the new image
# ------------------------------------------------------------------------------
echo "==> Re-running deploy.sh with METABASE_IMAGE=${TARGET_IMAGE}..."
if $DRY_RUN; then
  METABASE_IMAGE="${TARGET_IMAGE}" "${SCRIPT_DIR}/deploy.sh" --dry-run
else
  METABASE_IMAGE="${TARGET_IMAGE}" "${SCRIPT_DIR}/deploy.sh"
fi
echo ""

if $DRY_RUN; then
  echo "==> DRY-RUN: skipping Ready-state polling and verification."
  exit 0
fi

# ------------------------------------------------------------------------------
# Wait for the new revision to report Ready=True
# ------------------------------------------------------------------------------
# gcloud's format grammar does not support JMESPath-style predicate
# filters on arrays (e.g., `conditions[?type=Ready]`), so use
# --format=json and parse with jq. jq is a hard prerequisite for
# upgrades — check up front.
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required for upgrade.sh's Ready-state polling."
  echo "       Install via 'brew install jq' (macOS) or 'apt-get install jq'."
  exit 1
fi

echo "==> Waiting for new revision to become Ready (up to 10 min)..."
# 10 min accommodates Metabase cold start (~60-120s) plus Liquibase
# app-DB migrations on a major release, which can run several minutes.
DEADLINE=$(( $(date +%s) + 600 ))
READY=false
while (( $(date +%s) < DEADLINE )); do
  SERVICE_JSON=$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" --project="${PROJECT}" \
    --format=json 2>/dev/null || echo "{}")
  STATUS=$(echo "${SERVICE_JSON}" \
    | jq -r '.status.conditions[]? | select(.type=="Ready") | .status' 2>/dev/null \
    | head -1)
  CURRENT_DEPLOYED=$(echo "${SERVICE_JSON}" \
    | jq -r '.spec.template.spec.containers[0].image // empty' 2>/dev/null)

  TSNOW=$(date +%H:%M:%S)
  echo "[${TSNOW}] Ready=${STATUS:-Unknown}, deployed=${CURRENT_DEPLOYED##*:}"

  if [[ "${STATUS}" == "True" && "${CURRENT_DEPLOYED}" == "${TARGET_IMAGE}" ]]; then
    READY=true
    break
  fi
  sleep 15
done

echo ""
if $READY; then
  echo "==> Upgrade to ${TARGET_VERSION} deployed successfully."
else
  cat <<EOF
==> Upgrade did not reach Ready=True within 10 minutes.

Current state:
  Service:  ${SERVICE_NAME}
  Image:    ${CURRENT_DEPLOYED:-<unknown>}
  Ready:    ${STATUS:-Unknown}

Rollback options (the previous image is still on Cloud Run history):

  METABASE_IMAGE='${CURRENT_IMAGE}' ./deploy.sh

If the app DB schema migrated and rollback produces errors, restore
the pre-upgrade Cloud SQL backup (ID printed by backup.sh above):

  gcloud sql backups restore <BACKUP_ID> \\
    --restore-instance=metabase-app-db --project=${PROJECT}

EOF
  exit 1
fi

# ------------------------------------------------------------------------------
# Manual verification steps
# ------------------------------------------------------------------------------
cat <<EOF

==> Manual verification (IAP blocks unattended health checks):

1. Open https://bi.iampatterson.com/ in a browser. Expect the Metabase
   login page behind the IAP gate.
2. Log in with the admin account. Check the admin footer shows:
   Metabase v${TARGET_VERSION#v}
3. Open a saved dashboard or ask a new question against
   mart_campaign_performance. Verify rows return — this proves the BQ
   connection survived the upgrade.

If any step fails, roll back:

  METABASE_IMAGE='${CURRENT_IMAGE}' ./deploy.sh

And if the app DB was migrated past where the prior image supports:

  gcloud sql backups restore <BACKUP_ID> \\
    --restore-instance=metabase-app-db --project=${PROJECT}
EOF
