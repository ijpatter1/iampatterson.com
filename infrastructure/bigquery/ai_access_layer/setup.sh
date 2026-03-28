#!/usr/bin/env bash
#
# Set up the AI Access Layer:
#   1. Create a GCS bucket for parquet exports
#   2. Create a read-only service account scoped to mart datasets
#   3. Schedule BigQuery exports to GCS (parquet format)
#
# Usage:
#   ./setup.sh
#
# Prerequisites:
#   - gcloud authenticated with project owner/editor
#   - Project: iampatterson

set -euo pipefail

PROJECT="iampatterson"
REGION="us-central1"
BUCKET="gs://${PROJECT}-ai-exports"
SA_NAME="ai-access-reader"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

echo "=== AI Access Layer Setup ==="
echo ""

# ---------------------------------------------------------------------------
# 1. Create GCS bucket for exports
# ---------------------------------------------------------------------------
echo "--- Creating GCS bucket ---"
if gsutil ls "$BUCKET" 2>/dev/null; then
  echo "Bucket ${BUCKET} already exists"
else
  gsutil mb -l "$REGION" -p "$PROJECT" "$BUCKET"
  echo "Created ${BUCKET}"
fi

# Set lifecycle to auto-delete exports older than 30 days
cat > /tmp/lifecycle.json <<'LIFECYCLE'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
LIFECYCLE
gsutil lifecycle set /tmp/lifecycle.json "$BUCKET"
echo "Set 30-day lifecycle policy"

# ---------------------------------------------------------------------------
# 2. Create read-only service account
# ---------------------------------------------------------------------------
echo ""
echo "--- Creating service account ---"
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" 2>/dev/null; then
  echo "Service account ${SA_EMAIL} already exists"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT" \
    --display-name="AI Access Layer - Read Only" \
    --description="Read-only access to mart datasets for AI/ML pipelines and RAG"
  echo "Created ${SA_EMAIL}"
fi

# Grant BigQuery Data Viewer on mart datasets only
echo "Granting BigQuery Data Viewer on mart datasets..."
for DATASET in iampatterson_marts iampatterson_staging; do
  bq update --dataset \
    --source /dev/stdin \
    "${PROJECT}:${DATASET}" <<POLICY
{
  "access": [
    {
      "role": "READER",
      "userByEmail": "${SA_EMAIL}"
    }
  ]
}
POLICY
done

# Grant BigQuery Job User (needed to run queries)
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.jobUser" \
  --condition="None" \
  --quiet

# Grant Storage Object Creator on the export bucket
gsutil iam ch "serviceAccount:${SA_EMAIL}:objectCreator" "$BUCKET"
gsutil iam ch "serviceAccount:${SA_EMAIL}:objectViewer" "$BUCKET"

echo "Permissions configured"

# ---------------------------------------------------------------------------
# 3. Create export key
# ---------------------------------------------------------------------------
echo ""
echo "--- Creating service account key ---"
KEY_FILE="ai-access-key.json"
if [[ -f "$KEY_FILE" ]]; then
  echo "Key file already exists: ${KEY_FILE}"
else
  gcloud iam service-accounts keys create "$KEY_FILE" \
    --iam-account="$SA_EMAIL" \
    --project="$PROJECT"
  echo "Key saved to ${KEY_FILE}"
  echo "WARNING: Keep this key secure. Do not commit to git."
fi

echo ""
echo "=== Setup Complete ==="
echo "  Bucket:          ${BUCKET}"
echo "  Service Account: ${SA_EMAIL}"
echo "  Key File:        ${KEY_FILE}"
echo ""
echo "Next: Run export.sh to export mart data to GCS as parquet."
