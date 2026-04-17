#!/usr/bin/env bash
#
# Task 2 — Service accounts and IAM for Metabase.
# See docs/input_artifacts/metabase-deployment-plan.md (Task 2) for the spec.
#
# Idempotent. Generates the long-lived encryption key ONCE — losing it
# invalidates credentials encrypted in the Metabase app DB, so the script
# skips regeneration if the secret already exists. Generates a BigQuery SA
# JSON key to a temp file, uploads to Secret Manager, then shred+deletes
# the temp file and verifies it is gone before returning.
#
# Prerequisites:
#   - Task 1 completed: secret 'metabase-db-password' must exist.
#   - APIs enabled: iam, secretmanager, bigquery, cloudresourcemanager.
#   - IAM on executing principal:
#       iam.serviceAccountAdmin, iam.serviceAccountKeyAdmin,
#       secretmanager.admin, resourcemanager.projectIamAdmin,
#       OWNER (or equivalent) on the ${DATASET} dataset.
#
# Usage:
#   ./setup-iam.sh
#   ./setup-iam.sh --dry-run
#   PROJECT=my-project DATASET=other_marts ./setup-iam.sh

set -euo pipefail
# Surface API-not-enabled and other errors instead of blocking on stdin.
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT="${PROJECT:-iampatterson}"
DATASET="${DATASET:-iampatterson_marts}"
RUNTIME_SA="metabase-runtime"
BQ_SA="metabase-bigquery"
RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT}.iam.gserviceaccount.com"
BQ_SA_EMAIL="${BQ_SA}@${PROJECT}.iam.gserviceaccount.com"
DB_PW_SECRET="metabase-db-password"
ENC_KEY_SECRET="metabase-encryption-key"
BQ_KEY_SECRET="metabase-bq-sa-key"

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

echo "==> Project:      ${PROJECT}"
echo "==> Runtime SA:   ${RUNTIME_SA_EMAIL}"
echo "==> BQ SA:        ${BQ_SA_EMAIL}"
echo "==> BQ dataset:   ${PROJECT}:${DATASET}"
if $DRY_RUN; then echo "==> DRY-RUN mode: no changes will be made"; fi
echo ""

# -----------------------------------------------------------------------------
# Precondition: metabase-db-password from Task 1 must exist
# -----------------------------------------------------------------------------
echo "==> Checking Task 1 precondition..."
if ! gcloud secrets describe "${DB_PW_SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  cat <<EOF
ERROR: Secret '${DB_PW_SECRET}' does not exist. Task 1 must run first.
Run: ./setup-cloudsql.sh
EOF
  exit 1
fi
echo "Task 1 secret present."

# -----------------------------------------------------------------------------
# Service accounts
# -----------------------------------------------------------------------------
echo "==> Service accounts..."
create_sa() {
  local name="$1" desc="$2"
  local email="${name}@${PROJECT}.iam.gserviceaccount.com"
  if gcloud iam service-accounts describe "${email}" --project="${PROJECT}" >/dev/null 2>&1; then
    echo "SA ${name} exists, skipping."
  else
    run gcloud iam service-accounts create "${name}" \
      --project="${PROJECT}" \
      --display-name="${desc}"
  fi
}
create_sa "${RUNTIME_SA}" "Metabase Cloud Run runtime"
create_sa "${BQ_SA}" "Metabase BigQuery reader"

# -----------------------------------------------------------------------------
# Encryption key secret — generated ONCE, never rotated
# -----------------------------------------------------------------------------
echo "==> Secret ${ENC_KEY_SECRET}..."
if gcloud secrets describe "${ENC_KEY_SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Secret ${ENC_KEY_SECRET} exists — skipping (DO NOT REGENERATE)."
else
  echo "Generating encryption key (openssl rand -base64 32)..."
  run gcloud secrets create "${ENC_KEY_SECRET}" \
    --project="${PROJECT}" \
    --replication-policy=automatic \
    --labels=app=metabase,purpose=encryption-key

  if $DRY_RUN; then
    echo "+ openssl rand -base64 32 | gcloud secrets versions add ${ENC_KEY_SECRET} --data-file=-"
  else
    openssl rand -base64 32 | gcloud secrets versions add "${ENC_KEY_SECRET}" \
      --project="${PROJECT}" --data-file=-
  fi
fi

# -----------------------------------------------------------------------------
# BigQuery SA JSON key — generated to tmp, uploaded, local file destroyed
# -----------------------------------------------------------------------------
echo "==> Secret ${BQ_KEY_SECRET}..."
if gcloud secrets describe "${BQ_KEY_SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Secret ${BQ_KEY_SECRET} exists — skipping key generation."
else
  run gcloud secrets create "${BQ_KEY_SECRET}" \
    --project="${PROJECT}" \
    --replication-policy=automatic \
    --labels=app=metabase,purpose=bq-sa-key

  if $DRY_RUN; then
    echo "+ gcloud iam service-accounts keys create <mktemp> --iam-account=${BQ_SA_EMAIL}"
    echo "+ gcloud secrets versions add ${BQ_KEY_SECRET} --data-file=<mktemp>"
    echo "+ shred -u <mktemp>  (then verify file absent)"
  else
    KEY_TMP=$(mktemp)
    # Guarantee cleanup even if anything between key-create and delete crashes.
    trap 'if [[ -n "${KEY_TMP:-}" && -f "${KEY_TMP}" ]]; then shred -u "${KEY_TMP}" 2>/dev/null || rm -f "${KEY_TMP}"; fi' EXIT INT TERM

    echo "Generating BQ SA JSON key..."
    gcloud iam service-accounts keys create "${KEY_TMP}" \
      --iam-account="${BQ_SA_EMAIL}" \
      --project="${PROJECT}"

    VERSION=$(gcloud secrets versions add "${BQ_KEY_SECRET}" \
      --project="${PROJECT}" \
      --data-file="${KEY_TMP}" \
      --format="value(name)")

    shred -u "${KEY_TMP}" 2>/dev/null || rm -f "${KEY_TMP}"
    if [[ -f "${KEY_TMP}" ]]; then
      echo "ERROR: Failed to delete local key file ${KEY_TMP}"
      exit 1
    fi
    trap - EXIT INT TERM
    echo "Uploaded BQ SA key as ${VERSION}; local file deleted and verified absent."
  fi
fi

# -----------------------------------------------------------------------------
# IAM: metabase-runtime → cloudsql.client (project) + secret-scoped accessor
# -----------------------------------------------------------------------------
echo "==> IAM: ${RUNTIME_SA_EMAIL} → roles/cloudsql.client (project)..."
run gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None >/dev/null

echo "==> IAM: ${RUNTIME_SA_EMAIL} → roles/secretmanager.secretAccessor on metabase secrets..."
for SECRET in "${DB_PW_SECRET}" "${ENC_KEY_SECRET}" "${BQ_KEY_SECRET}"; do
  run gcloud secrets add-iam-policy-binding "${SECRET}" \
    --project="${PROJECT}" \
    --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None >/dev/null
done

# -----------------------------------------------------------------------------
# IAM: metabase-bigquery → dataViewer (dataset-scoped) + jobUser (project)
# -----------------------------------------------------------------------------
echo "==> IAM: ${BQ_SA_EMAIL} → roles/bigquery.dataViewer on ${PROJECT}:${DATASET}..."
if $DRY_RUN; then
  echo "+ bq --project_id=${PROJECT} add-iam-policy-binding \\"
  echo "    --member=serviceAccount:${BQ_SA_EMAIL} \\"
  echo "    --role=roles/bigquery.dataViewer ${PROJECT}:${DATASET}"
else
  bq --project_id="${PROJECT}" add-iam-policy-binding \
    --member="serviceAccount:${BQ_SA_EMAIL}" \
    --role="roles/bigquery.dataViewer" \
    "${PROJECT}:${DATASET}" >/dev/null
fi

echo "==> IAM: ${BQ_SA_EMAIL} → roles/bigquery.jobUser (project)..."
run gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${BQ_SA_EMAIL}" \
  --role="roles/bigquery.jobUser" \
  --condition=None >/dev/null

echo ""
echo "==> Done."
echo ""
echo "Verify (run these one at a time and inspect):"
echo "  gcloud iam service-accounts list --filter='email:metabase-*' --format='value(email)'"
echo "  gcloud secrets list --filter='name:metabase-*' --format='value(name)'"
echo "  gcloud secrets get-iam-policy ${DB_PW_SECRET} --format='value(bindings.members)'"
echo "  bq show --format=prettyjson ${PROJECT}:${DATASET} | jq '.access[] | select((.userByEmail // .iamMember // \"\") | test(\"metabase\"))'"
echo "  ls -la *.json  # expect: no metabase-bigquery key files in the working tree"
