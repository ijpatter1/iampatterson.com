#!/usr/bin/env bash
# Pub/Sub setup for the real-time event pipeline.
# Idempotent — safe to run multiple times.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCP project "iampatterson" selected
#
# Creates:
#   - Topic: iampatterson-events
#   - Push subscription: iampatterson-events-push (delivers to Cloud Run)

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-iampatterson}"
TOPIC_NAME="iampatterson-events"
SUBSCRIPTION_NAME="iampatterson-events-push"

# Cloud Run service URL — must be set before running this script
if [[ -z "${EVENT_STREAM_URL:-}" ]]; then
  echo "ERROR: EVENT_STREAM_URL is not set."
  echo "Run: export EVENT_STREAM_URL=\$(gcloud run services describe event-stream --region=us-central1 --format='value(status.url)')"
  exit 1
fi
PUSH_ENDPOINT="${EVENT_STREAM_URL}/pubsub/push"

echo "=== Pub/Sub Setup for ${PROJECT_ID} ==="

# Create topic (idempotent)
if gcloud pubsub topics describe "${TOPIC_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Topic '${TOPIC_NAME}' already exists."
else
  echo "Creating topic '${TOPIC_NAME}'..."
  gcloud pubsub topics create "${TOPIC_NAME}" --project="${PROJECT_ID}"
fi

# Create push subscription (idempotent)
if gcloud pubsub subscriptions describe "${SUBSCRIPTION_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Subscription '${SUBSCRIPTION_NAME}' already exists."
  echo "Updating push endpoint..."
  gcloud pubsub subscriptions update "${SUBSCRIPTION_NAME}" \
    --project="${PROJECT_ID}" \
    --push-endpoint="${PUSH_ENDPOINT}"
else
  echo "Creating push subscription '${SUBSCRIPTION_NAME}'..."
  gcloud pubsub subscriptions create "${SUBSCRIPTION_NAME}" \
    --project="${PROJECT_ID}" \
    --topic="${TOPIC_NAME}" \
    --push-endpoint="${PUSH_ENDPOINT}" \
    --ack-deadline=30 \
    --min-retry-delay=10s \
    --max-retry-delay=600s
fi

echo ""
echo "=== Setup complete ==="
echo "Topic:        ${TOPIC_NAME}"
echo "Subscription: ${SUBSCRIPTION_NAME}"
echo "Push endpoint: ${PUSH_ENDPOINT}"
echo ""
echo "Next steps:"
echo "  1. Deploy the Cloud Run event-stream service"
echo "  2. Update EVENT_STREAM_URL and re-run this script"
echo "  3. Configure the sGTM Pub/Sub tag (see infrastructure/gtm/server-container.json)"
