# Pub/Sub — Real-Time Event Pipeline

## Architecture

```
sGTM (io.iampatterson.com)
  → Pub/Sub topic: iampatterson-events
    → Push subscription → Cloud Run event-stream service
      → SSE to browser (scoped by session_id)
```

## Setup

```bash
# Set your Cloud Run service URL after deploying
export EVENT_STREAM_URL=https://event-stream-XXXXXXXXXX.run.app

# Run the setup script (idempotent)
./setup.sh
```

## Topic: `iampatterson-events`

Every event processed by sGTM is published to this topic. The message payload is a JSON object containing the full event data from `getAllEventData()` plus the `session_id` from the `_iap_sid` cookie.

### Message Schema

```json
{
  "pipeline_id": "pipe-1711468800000-1",
  "received_at": "2026-03-26T12:00:00.000Z",
  "session_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "event_name": "page_view",
  "timestamp": "2026-03-26T11:59:59.500Z",
  "page_path": "/",
  "page_title": "Home — Patterson Consulting",
  "page_location": "https://iampatterson-com.vercel.app/",
  "parameters": { "page_referrer": "/about" },
  "consent": {
    "analytics_storage": "granted",
    "ad_storage": "denied",
    "ad_user_data": "denied",
    "ad_personalization": "denied",
    "functionality_storage": "granted"
  },
  "routing": [
    { "destination": "ga4", "status": "sent", "timestamp": "..." },
    { "destination": "bigquery", "status": "sent", "timestamp": "..." }
  ]
}
```

## Subscription: `iampatterson-events-push`

Push subscription that delivers messages to the Cloud Run service at `POST /pubsub/push`. Messages are base64-encoded JSON in the standard Pub/Sub push envelope.

## sGTM Tag

The sGTM Pub/Sub tag configuration is documented in `infrastructure/gtm/server-container.json` under the "Pub/Sub - Publish All Events" tag.
