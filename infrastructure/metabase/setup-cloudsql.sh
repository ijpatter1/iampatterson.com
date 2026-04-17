#!/usr/bin/env bash
#
# Task 1 — Cloud SQL Postgres app DB for Metabase.
# See docs/input_artifacts/metabase-deployment-plan.md for the full spec.
#
# Idempotent — safe to re-run. Resources are checked before creation.
# No secrets are echoed to stdout; passwords flow via stdin or variable only.
#
# Prerequisites (see README.md for details):
#   - gcloud authenticated; project set via `gcloud config set project iampatterson`
#   - IAM roles on executing principal: cloudsql.admin, secretmanager.admin,
#     billing.viewer, billing.projectManager
#   - APIs enabled: sqladmin, secretmanager, servicenetworking, cloudbilling,
#     billingbudgets
#   - VPC peering to servicenetworking.googleapis.com on the default network
#
# Usage:
#   ./setup-cloudsql.sh
#   ./setup-cloudsql.sh --dry-run
#   PROJECT=my-project REGION=us-east1 ./setup-cloudsql.sh

set -euo pipefail

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
NETWORK="${NETWORK:-default}"
INSTANCE="metabase-app-db"
DB_NAME="metabase"
DB_USER="metabase"
PW_SECRET="metabase-db-password"
BUDGET_NAME="metabase-project-budget"
BUDGET_AMOUNT="100"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

run() {
  echo "+ $*"
  if ! $DRY_RUN; then
    "$@"
  fi
}

echo "==> Project:  ${PROJECT}"
echo "==> Region:   ${REGION}"
echo "==> Network:  ${NETWORK}"
echo "==> Instance: ${INSTANCE}"
if $DRY_RUN; then echo "==> DRY-RUN mode: no changes will be made"; fi
echo ""

# -----------------------------------------------------------------------------
# Prerequisite: VPC peering for private services access
# -----------------------------------------------------------------------------
echo "==> Checking VPC peering for servicenetworking..."
PEERING_OUTPUT=$(gcloud services vpc-peerings list \
  --service=servicenetworking.googleapis.com \
  --network="${NETWORK}" \
  --project="${PROJECT}" \
  --format="value(service)" 2>/dev/null || true)
if [[ -z "${PEERING_OUTPUT}" ]]; then
  cat <<EOF
ERROR: No VPC peering to servicenetworking.googleapis.com on network
'${NETWORK}'. Cloud SQL with private IP requires this peering. Run once:

  gcloud compute addresses create google-managed-services-default \\
    --project=${PROJECT} --global --purpose=VPC_PEERING \\
    --prefix-length=16 --network=${NETWORK}

  gcloud services vpc-peerings connect \\
    --project=${PROJECT} \\
    --service=servicenetworking.googleapis.com \\
    --ranges=google-managed-services-default --network=${NETWORK}

Then re-run this script.
EOF
  exit 1
fi
echo "Peering OK."

# -----------------------------------------------------------------------------
# Cloud SQL instance
# -----------------------------------------------------------------------------
echo "==> Cloud SQL instance..."
if gcloud sql instances describe "${INSTANCE}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Instance ${INSTANCE} exists, skipping."
else
  echo "Creating instance ${INSTANCE} (this takes 5-10 minutes)..."
  run gcloud sql instances create "${INSTANCE}" \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --no-assign-ip \
    --network="projects/${PROJECT}/global/networks/${NETWORK}" \
    --backup-start-time=03:00 \
    --retained-backups-count=7 \
    --enable-point-in-time-recovery \
    --backup-location="${REGION}"
fi

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
echo "==> Database..."
if gcloud sql databases describe "${DB_NAME}" \
     --instance="${INSTANCE}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Database ${DB_NAME} exists, skipping."
else
  run gcloud sql databases create "${DB_NAME}" \
    --instance="${INSTANCE}" --project="${PROJECT}"
fi

# -----------------------------------------------------------------------------
# Password + Secret Manager secret + Cloud SQL user
# -----------------------------------------------------------------------------
echo "==> Secret ${PW_SECRET}..."
if gcloud secrets describe "${PW_SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Secret ${PW_SECRET} exists, skipping password generation and user creation."
  echo "  (If the Cloud SQL user does not exist or needs a reset, do it manually"
  echo "   using the password from \`gcloud secrets versions access latest"
  echo "   --secret=${PW_SECRET}\`.)"
else
  echo "Generating password, creating secret, and creating Cloud SQL user..."
  PW=$(openssl rand -base64 24)

  run gcloud secrets create "${PW_SECRET}" \
    --project="${PROJECT}" \
    --replication-policy=automatic \
    --labels=app=metabase,purpose=db-password

  # Add secret version via stdin so the password never appears on a command line.
  if $DRY_RUN; then
    echo "+ gcloud secrets versions add ${PW_SECRET} --data-file=- <<<(generated password)"
  else
    printf '%s' "${PW}" | gcloud secrets versions add "${PW_SECRET}" \
      --project="${PROJECT}" --data-file=-
  fi

  # Create the Cloud SQL user. gcloud requires --password on the flag; avoid
  # echoing it by calling gcloud directly instead of through the `run` wrapper.
  if $DRY_RUN; then
    echo "+ gcloud sql users create ${DB_USER} --instance=${INSTANCE} --password=<redacted>"
  else
    gcloud sql users create "${DB_USER}" \
      --instance="${INSTANCE}" \
      --project="${PROJECT}" \
      --password="${PW}"
  fi

  unset PW
fi

# -----------------------------------------------------------------------------
# Budget alert
# -----------------------------------------------------------------------------
echo "==> Budget alert..."
BILLING_ACCOUNT=$(gcloud beta billing projects describe "${PROJECT}" \
  --format="value(billingAccountName)" 2>/dev/null \
  | sed 's|billingAccounts/||' || true)

if [[ -z "${BILLING_ACCOUNT}" ]]; then
  echo "WARNING: No billing account linked to ${PROJECT}. Skipping budget alert."
  echo "         Link a billing account, then re-run to create the \$${BUDGET_AMOUNT}/month alert."
else
  echo "Billing account: ${BILLING_ACCOUNT}"
  EXISTING=$(gcloud billing budgets list \
    --billing-account="${BILLING_ACCOUNT}" \
    --filter="displayName=${BUDGET_NAME}" \
    --format="value(name)" 2>/dev/null || true)
  if [[ -n "${EXISTING}" ]]; then
    echo "Budget '${BUDGET_NAME}' exists, skipping."
  else
    echo "Creating budget '${BUDGET_NAME}' at \$${BUDGET_AMOUNT}/month..."
    run gcloud billing budgets create \
      --billing-account="${BILLING_ACCOUNT}" \
      --display-name="${BUDGET_NAME}" \
      --budget-amount="${BUDGET_AMOUNT}USD" \
      --threshold-rule=percent=0.5 \
      --threshold-rule=percent=0.9 \
      --threshold-rule=percent=1.0 \
      --filter-projects="projects/${PROJECT}"
  fi
fi

echo ""
echo "==> Done."
echo ""
echo "Verify:"
echo "  gcloud sql instances describe ${INSTANCE} --project=${PROJECT} \\"
echo "    --format='value(settings.backupConfiguration.enabled,settings.backupConfiguration.pointInTimeRecoveryEnabled)'"
echo "    # expect: True    True"
echo "  gcloud secrets describe ${PW_SECRET} --project=${PROJECT}"
