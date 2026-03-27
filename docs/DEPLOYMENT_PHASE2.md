# Phase 2 Infrastructure Deployment Guide

> **Scope:** Deploy the real-time event pipeline — Cloud Run SSE service, Pub/Sub topic + subscription, sGTM Pub/Sub tag, and BigQuery table (if not already created).
>
> **Prerequisites completed:** All Phase 2 code is written and tested. This guide covers only the infrastructure provisioning and configuration needed to make the pipeline operational.

---

## Table of Contents

1. [Prerequisites](#1--prerequisites)
2. [Architecture Recap](#2--architecture-recap)
3. [Step 1 — BigQuery Setup](#3--step-1--bigquery-setup)
4. [Step 2 — Deploy the Cloud Run SSE Service](#4--step-2--deploy-the-cloud-run-sse-service)
5. [Step 3 — Create Pub/Sub Topic and Subscription](#5--step-3--create-pubsub-topic-and-subscription)
6. [Step 4 — Create the sGTM Pub/Sub Tag](#6--step-4--create-the-sgtm-pubsub-tag)
7. [Step 5 — Wire the Frontend](#7--step-5--wire-the-frontend)
8. [Step 6 — End-to-End Verification](#8--step-6--end-to-end-verification)
9. [Security Hardening](#9--security-hardening)
10. [Troubleshooting](#10--troubleshooting)
11. [Resource Reference](#11--resource-reference)

---

## 1 — Prerequisites

### Tools Required

| Tool | Purpose | Install |
|------|---------|---------|
| `gcloud` CLI | GCP resource management | [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) |
| `bq` CLI | BigQuery table creation | Included with `gcloud` SDK |
| `docker` | Build Cloud Run container image | [docs.docker.com/get-docker](https://docs.docker.com/get-docker) |
| Stape account | sGTM container management | [stape.io](https://stape.io) |

### Authentication

```bash
# Authenticate with GCP
gcloud auth login

# Set the project
gcloud config set project iampatterson

# Verify
gcloud config get-value project
# → iampatterson
```

### Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  pubsub.googleapis.com \
  bigquery.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### Verify Existing Infrastructure

Before proceeding, confirm Phase 1 infrastructure is operational:

```bash
# sGTM is reachable (should return HTML or redirect)
curl -sI https://io.iampatterson.com | head -5

# Vercel frontend is live
curl -sI https://iampatterson-com.vercel.app | head -5
```

---

## 2 — Architecture Recap

```
Browser (Vercel)
  → pushEvent() to GTM data layer
    → GTM Web Container (GTM-MWHFMTZN)
      → sGTM on Stape (io.iampatterson.com, GTM-NTTKZFWD)
        ├─ GA4 Forwarding (already active)
        ├─ BigQuery Write (already active)
        └─ Pub/Sub Publish ← NEW (Step 4)
          → Pub/Sub topic: iampatterson-events ← NEW (Step 3)
            → Push subscription → Cloud Run SSE service ← NEW (Step 2)
              → SSE to browser via useEventStream hook ← NEW (Step 5)
```

**Deployment order matters.** Each step depends on the one before it:

1. BigQuery (independent, may already exist from Phase 1)
2. Cloud Run (must be deployed first to get its URL)
3. Pub/Sub (needs Cloud Run URL for the push endpoint)
4. sGTM tag (needs Pub/Sub topic to exist)
5. Frontend wiring (needs Cloud Run URL for the SSE endpoint)

---

## 3 — Step 1 — BigQuery Setup

> **Skip if already done.** If `iampatterson_raw.events_raw` already exists from Phase 1 setup, verify and move on.

### Check if table exists

```bash
bq show --project_id=iampatterson iampatterson_raw.events_raw
```

If the table exists, skip to Step 2.

### Create dataset and table

```bash
cd /path/to/iampatterson.com
./infrastructure/bigquery/setup.sh
```

This script is idempotent. It creates:

- **Dataset:** `iampatterson_raw` (US region)
- **Table:** `events_raw` — daily-partitioned, clustered by `event_name` and `session_id`

### Verify

```bash
bq show --schema --format=prettyjson iampatterson:iampatterson_raw.events_raw
```

You should see 22 columns including `event_name` (REQUIRED), `received_timestamp` (REQUIRED), `session_id`, page context fields, event-specific fields, and `user_agent`/`ip_override`.

---

## 4 — Step 2 — Deploy the Cloud Run SSE Service

### 2a. Set up Artifact Registry (one-time)

```bash
# Create a Docker repository in Artifact Registry
gcloud artifacts repositories create iampatterson-services \
  --repository-format=docker \
  --location=us-central1 \
  --description="Container images for iampatterson.com backend services"
```

### 2b. Build and push the Docker image

```bash
cd infrastructure/cloud-run/event-stream

# Configure Docker to use Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build the image (--platform is required when building on Apple Silicon)
docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/iampatterson/iampatterson-services/event-stream:v1 .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/iampatterson/iampatterson-services/event-stream:v1
```

**Alternative: Use Cloud Build** (builds remotely, no local Docker required):

```bash
cd infrastructure/cloud-run/event-stream

gcloud builds submit \
  --tag us-central1-docker.pkg.dev/iampatterson/iampatterson-services/event-stream:v2
```

### 2c. Deploy to Cloud Run

```bash
gcloud run deploy event-stream \
  --image=us-central1-docker.pkg.dev/iampatterson/iampatterson-services/event-stream:v2 \
  --region=us-central1 \
  --platform=managed \
  --port=8080 \
  --allow-unauthenticated \
  --set-env-vars='^##^ALLOWED_ORIGINS=https://iampatterson-com.vercel.app,https://iampatterson.com' \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=3600 \
  --cpu=1 \
  --memory=256Mi \
  --session-affinity
```

**Key flags explained:**

| Flag | Why |
|------|-----|
| `--allow-unauthenticated` | Browsers connect directly via SSE — no auth header available. Pub/Sub push auth is handled separately at the application level. |
| `--min-instances=1` | SSE connections are long-lived. A cold start kills all active connections. Keep at least 1 instance warm. |
| `--timeout=3600` | SSE connections can last up to 60 minutes (Cloud Run max). Default 300s would kill connections early. |
| `--session-affinity` | Routes repeat requests from the same client to the same instance. Critical for SSE — the Pub/Sub push message must reach the instance holding that session's connection. |
| `--port=8080` | Matches the `EXPOSE 8080` in the Dockerfile and the `PORT` env var default. |

### 2d. Capture the service URL

```bash
# Get the deployed URL
gcloud run services describe event-stream \
  --region=us-central1 \
  --format='value(status.url)'
```

**Save this URL** — you need it for Steps 3 and 5. It will look like:

```
https://event-stream-262727068689.us-central1.run.app
https://event-stream-eb4xrwmo3q-uc.a.run.app
```

### 2e. Verify the service is healthy

```bash
EVENT_STREAM_URL=$(gcloud run services describe event-stream \
  --region=us-central1 --format='value(status.url)')

curl -s "${EVENT_STREAM_URL}/health"
# → {"status":"ok","connections":0}
```

---

## 5 — Step 3 — Create Pub/Sub Topic and Subscription

### 3a. Run the setup script

```bash
# Set the Cloud Run URL from Step 2d
export EVENT_STREAM_URL="https://event-stream-XXXXXXXXXX-uc.a.run.app"

cd /path/to/iampatterson.com
./infrastructure/pubsub/setup.sh
```

This creates:

- **Topic:** `iampatterson-events`
- **Push subscription:** `iampatterson-events-push`
  - Push endpoint: `${EVENT_STREAM_URL}/pubsub/push`
  - Ack deadline: 30s
  - Retry: 10s min, 600s max backoff

### 3b. Verify resources

```bash
# Check topic
gcloud pubsub topics describe iampatterson-events --project=iampatterson

# Check subscription and its push config
gcloud pubsub subscriptions describe iampatterson-events-push --project=iampatterson
```

Confirm the `pushConfig.pushEndpoint` matches your Cloud Run URL + `/pubsub/push`.

### 3c. Test the pipeline with a manual publish

This sends a synthetic event through Pub/Sub to verify routing works end-to-end from Pub/Sub → Cloud Run.

**Terminal 1 — Open an SSE connection:**

```bash
# Connect as a fake session
curl -N "${EVENT_STREAM_URL}/events?session_id=test-session-123"
```
```
gcloud pubsub subscriptions update iampatterson-events-push \
--push-endpoint="${EVENT_STREAM_URL}/pubsub/push" \
--project=iampatterson
```
```
EVENT_STREAM_URL=$(gcloud run services describe event-stream \
--region=us-central1 --format='value(status.url)')
```
You should see the initial connection message:

```
data: {"type":"connected","session_id":"test-session-123"}
```

**Terminal 2 — Publish a test message:**

```bash
# Create the test payload
TEST_PAYLOAD=$(echo -n '{
  "pipeline_id": "test-001",
  "received_at": "2026-03-27T12:00:00.000Z",
  "session_id": "test-session-123",
  "event_name": "page_view",
  "timestamp": "2026-03-27T11:59:59.500Z",
  "page_path": "/",
  "page_title": "Test",
  "page_location": "https://iampatterson.com/",
  "parameters": {},
  "consent": {
    "analytics_storage": "granted",
    "ad_storage": "denied",
    "ad_user_data": "denied",
    "ad_personalization": "denied",
    "functionality_storage": "granted"
  },
  "routing": [
    {"destination": "ga4", "status": "sent", "timestamp": "2026-03-27T12:00:00.100Z"},
    {"destination": "bigquery", "status": "sent", "timestamp": "2026-03-27T12:00:00.200Z"},
    {"destination": "pubsub", "status": "sent", "timestamp": "2026-03-27T12:00:00.300Z"}
  ]
}' | base64)

# Publish to Pub/Sub
gcloud pubsub topics publish iampatterson-events \
  --message="${TEST_PAYLOAD}" \
  --project=iampatterson
```

**Wait:** In Terminal 1, within 1-3 seconds you should see the event appear in the SSE stream. If it doesn't arrive, see [Troubleshooting](#10--troubleshooting).

> **Note:** The `gcloud pubsub topics publish --message` flag sends the message as the raw data field. The push subscription delivers it in a Pub/Sub envelope with `message.data` base64-encoded. However, since we're already base64-encoding it here, the Cloud Run service's `parsePubSubMessage` expects `message.data` to be a base64 string it can decode. If you get parse errors, try publishing the raw JSON without base64 encoding — `gcloud` will base64-encode it automatically in the push envelope.

**Simpler alternative — publish raw JSON and let Pub/Sub handle encoding:**

```bash
gcloud pubsub topics publish iampatterson-events \
  --message='{
    "pipeline_id": "test-001",
    "received_at": "2026-03-27T12:00:00.000Z",
    "session_id": "test-session-123",
    "event_name": "page_view",
    "timestamp": "2026-03-27T11:59:59.500Z",
    "page_path": "/",
    "page_title": "Test",
    "page_location": "https://iampatterson.com/",
    "parameters": {},
    "consent": {
      "analytics_storage": "granted",
      "ad_storage": "denied",
      "ad_user_data": "denied",
      "ad_personalization": "denied",
      "functionality_storage": "granted"
    },
    "routing": [
      {"destination": "ga4", "status": "sent", "timestamp": "2026-03-27T12:00:00.100Z"}
    ]
  }' \
  --project=iampatterson
```

When delivered via push subscription, Pub/Sub wraps this in an envelope like:

```json
{
  "message": {
    "data": "<base64 of the JSON above>",
    "messageId": "...",
    "publishTime": "..."
  },
  "subscription": "projects/iampatterson/subscriptions/iampatterson-events-push"
}
```

The Cloud Run router's `parsePubSubMessage` decodes `message.data` from base64 back to JSON. This is the correct path.

---

## 6 — Step 4 — Create the sGTM Pub/Sub Tag

This is the only step that requires manual UI work. The tag fires on every event in sGTM and publishes the full event payload to Pub/Sub.

### 4a. Understand the approach

sGTM doesn't have a native Pub/Sub tag template. You have two options:

**Option A — Custom HTTP Request tag** (recommended for simplicity):
Use sGTM's built-in HTTP Request tag to call the Pub/Sub REST API directly.

**Option B — Custom template:**
Build a custom sGTM tag template that calls the Pub/Sub API using sGTM's `sendHttpRequest` API.

Both options require sGTM to authenticate with GCP. On Stape, this is handled via the Stape GCP integration or by configuring a GCP service account in the sGTM container settings.

### 4b. Stape GCP authentication setup

Before creating the tag, ensure Stape can publish to your Pub/Sub topic:

1. **In Stape dashboard** → Open your server container → **Settings** → **GCP Integration**
2. If not already configured, add a GCP service account JSON key:
   - Go to GCP Console → IAM → Service Accounts
   - Create a service account: `sgtm-pubsub-publisher@iampatterson.iam.gserviceaccount.com`
   - Grant it the role: **Pub/Sub Publisher** (`roles/pubsub.publisher`) on the `iampatterson-events` topic
   - Create a JSON key and upload it to Stape

Alternatively, if Stape is running on your GCP project, it may already have permissions via the default service account.

### 4c. Create the custom tag (Option A — HTTP Request)

**In the sGTM container on Stape (GTM-NTTKZFWD):**

1. **Tags** → **New** → **Custom** → Choose **HTTP Request** tag type

2. **Tag name:** `Pub/Sub - Publish All Events`

3. **Request URL:**
   ```
   https://pubsub.googleapis.com/v1/projects/iampatterson/topics/iampatterson-events:publish
   ```

4. **Method:** POST

5. **Headers:**
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer {{GCP Access Token}}` (use Stape's GCP integration or a variable that calls `getGoogleAuth()`)

6. **Request Body** — Build a JSON payload using sGTM variables:

   ```json
   {
     "messages": [
       {
         "data": "{{Base64 Encoded Event Payload}}"
       }
     ]
   }
   ```

   Where `{{Base64 Encoded Event Payload}}` is a **custom variable** (see step 4d).

7. **Firing trigger:** `All GA4 Events`

8. **Consent:** No consent requirement (the tag fires on all events; consent state is included in the payload for downstream consumers to decide on)

### 4d. Create the payload variable

Create a **custom JavaScript variable** in sGTM to build and base64-encode the event payload:

**Variable name:** `Base64 Encoded Event Payload`
**Type:** Custom JavaScript

```javascript
function() {
  var data = require('getAllEventData')();
  var getCookieValues = require('getCookieValues');
  var getTimestampMillis = require('getTimestampMillis');
  var isConsentGranted = require('isConsentGranted');
  var toBase64 = require('toBase64');
  var JSON = require('JSON');
  var generateRandom = require('generateRandom');

  var sessionId = getCookieValues('_iap_sid')[0] || '';
  var receivedAt = new Date(getTimestampMillis()).toISOString();
  var pipelineId = 'pipe-' + getTimestampMillis() + '-' + generateRandom(1, 999999);

  var payload = {
    pipeline_id: pipelineId,
    received_at: receivedAt,
    session_id: sessionId,
    event_name: data.event_name || '',
    timestamp: data.timestamp || '',
    page_path: data.page_path || data.page_location_path || '',
    page_title: data.page_title || '',
    page_location: data.page_location || '',
    parameters: {
      page_referrer: data.page_referrer || '',
      depth_percentage: data.depth_percentage || null,
      depth_pixels: data.depth_pixels || null,
      link_text: data.link_text || null,
      link_url: data.link_url || null,
      cta_text: data.cta_text || null,
      cta_location: data.cta_location || null,
      form_name: data.form_name || null,
      field_name: data.field_name || null,
      form_success: data.form_success || null,
      consent_analytics: data.consent_analytics || null,
      consent_marketing: data.consent_marketing || null,
      consent_preferences: data.consent_preferences || null
    },
    consent: {
      analytics_storage: isConsentGranted('analytics_storage') ? 'granted' : 'denied',
      ad_storage: isConsentGranted('ad_storage') ? 'granted' : 'denied',
      ad_user_data: isConsentGranted('ad_user_data') ? 'granted' : 'denied',
      ad_personalization: isConsentGranted('ad_personalization') ? 'granted' : 'denied',
      functionality_storage: isConsentGranted('functionality_storage') ? 'granted' : 'denied'
    },
    routing: [
      {
        destination: 'ga4',
        status: isConsentGranted('analytics_storage') ? 'sent' : 'blocked_consent',
        timestamp: receivedAt
      },
      {
        destination: 'bigquery',
        status: isConsentGranted('analytics_storage') ? 'sent' : 'blocked_consent',
        timestamp: receivedAt
      },
      {
        destination: 'pubsub',
        status: 'sent',
        timestamp: receivedAt
      }
    ]
  };

  return toBase64(JSON.stringify(payload));
}
```

> **Note on `null` values in parameters:** The `parsePubSubMessage` router on Cloud Run does not strip nulls. The `isPipelineEvent` type guard accepts `parameters` as `Record<string, string | number | boolean>`. If your sGTM variable sends null values, either strip them in the variable code or replace the null fallbacks above with empty strings / omit the keys entirely.

### 4e. Verify in sGTM preview mode

1. Open the sGTM container in **Preview mode** on Stape
2. Visit `https://iampatterson-com.vercel.app` in a browser
3. Navigate around, click a CTA, start the contact form
4. In sGTM Preview:
   - Confirm the `Pub/Sub - Publish All Events` tag fires on every event
   - Check the outgoing HTTP request — it should POST to the Pub/Sub REST API
   - Response should be `200 OK` with a `messageIds` array
5. If the tag shows errors (403 Forbidden, etc.), check the auth configuration in Step 4b

---

## 7 — Step 5 — Wire the Frontend

The `useEventStream` hook requires the Cloud Run service URL. This should be provided as an environment variable in the Next.js app.

### 5a. Add environment variable to Vercel

```bash
# In the Vercel dashboard, or via CLI:
vercel env add NEXT_PUBLIC_EVENT_STREAM_URL

# Value: https://event-stream-eb4xrwmo3q-uc.a.run.app
# Environments: Production, Preview, Development
```

Or add to `.env.local` for local development:

```bash
NEXT_PUBLIC_EVENT_STREAM_URL=https://event-stream-eb4xrwmo3q-uc.a.run.app
```

### 5b. Consume in the flip-the-card overlay (Phase 3)

The `useEventStream` hook is already built. When Phase 3 implements the overlay, it will use:

```typescript
const { status, events, error, clearEvents } = useEventStream({
  url: process.env.NEXT_PUBLIC_EVENT_STREAM_URL ?? '',
  enabled: overlayIsOpen, // only connect when overlay is visible
});
```

### 5c. Redeploy the frontend

After setting the env var:

```bash
# Vercel auto-deploys on git push, or manually:
vercel --prod
```

---

## 8 — Step 6 — End-to-End Verification

This is the full pipeline test: browser event → GTM → sGTM → Pub/Sub → Cloud Run → SSE → browser.

### 6a. Open two browser tabs

**Tab 1 — SSE listener (raw):**

```
https://event-stream-XXXXXXXXXX-uc.a.run.app/events?session_id=<YOUR_SESSION_ID>
```

To get your session ID, visit `https://iampatterson-com.vercel.app`, open DevTools → Application → Cookies, and find `_iap_sid`.

**Tab 2 — The website:**

Visit `https://iampatterson-com.vercel.app` and interact (navigate, scroll, click CTAs).

### 6b. What to expect

In Tab 1 (SSE stream), you should see events arriving within 1-5 seconds of each interaction:

```
data: {"type":"connected","session_id":"abc-123-..."}

data: {"pipeline_id":"pipe-1711540800000-42","event_name":"page_view",...}

data: {"pipeline_id":"pipe-1711540801000-43","event_name":"scroll_depth",...}
```

### 6c. Verify each hop

| Hop | How to verify |
|-----|--------------|
| Browser → GTM | DevTools → Network tab: requests to `io.iampatterson.com/g/collect?...` |
| GTM → sGTM | sGTM Preview mode on Stape: events appear in the live stream |
| sGTM → Pub/Sub | sGTM Preview: `Pub/Sub - Publish All Events` tag shows 200 response |
| Pub/Sub → Cloud Run | Cloud Run logs: `gcloud run services logs read event-stream --region=us-central1 --limit=20` |
| Cloud Run → Browser | SSE stream in Tab 1 shows the event data |

### 6d. Check Cloud Run logs for errors

```bash
gcloud run services logs read event-stream \
  --region=us-central1 \
  --limit=50 \
  --format="table(timestamp, textPayload)"
```

---

## 9 — Security Hardening

### 9a. Pub/Sub OIDC authentication (important for production)

The push endpoint at `POST /pubsub/push` currently accepts any request. Before going to production, implement OIDC JWT verification:

1. **Create a service account for Pub/Sub push:**

   ```bash
   gcloud iam service-accounts create pubsub-push-invoker \
     --display-name="Pub/Sub Push to Cloud Run"
   ```

2. **Update the push subscription with OIDC config:**

   ```bash
   gcloud pubsub subscriptions update iampatterson-events-push \
     --push-auth-service-account=pubsub-push-invoker@iampatterson.iam.gserviceaccount.com \
     --push-auth-token-audience=https://event-stream-XXXXXXXXXX-uc.a.run.app
   ```

3. **Implement JWT verification in the Cloud Run service.**
   Add middleware to `POST /pubsub/push` that:
   - Extracts the `Authorization: Bearer <token>` header
   - Verifies the JWT signature against Google's public keys
   - Checks the `audience` claim matches the service URL
   - Checks the `email` claim matches the push service account

   Reference: [Authenticate push subscriptions](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions)

### 9b. Content Security Policy

Add a CSP header to `vercel.json` that allowlists the Cloud Run domain for SSE connections:

```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://consent.cookiebot.com https://www.googletagmanager.com https://io.iampatterson.com; connect-src 'self' https://io.iampatterson.com https://event-stream-XXXXXXXXXX-uc.a.run.app https://consent.cookiebot.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-src https://consentcdn.cookiebot.com;"
}
```

Replace `event-stream-XXXXXXXXXX-uc.a.run.app` with your actual Cloud Run URL.

### 9c. CORS verification

The Cloud Run service restricts CORS to origins in the `ALLOWED_ORIGINS` env var. After deployment, verify:

```bash
# Should return the allowed origin
curl -sI -H "Origin: https://iampatterson.com" \
  "${EVENT_STREAM_URL}/events?session_id=test" | grep -i access-control

# Should NOT return a matching origin
curl -sI -H "Origin: https://evil.com" \
  "${EVENT_STREAM_URL}/events?session_id=test" | grep -i access-control
```

---

## 10 — Troubleshooting

### Events not arriving in SSE stream

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| SSE connects but no events arrive | sGTM Pub/Sub tag not firing | Check sGTM Preview — is the tag listed? Does it show a 200 response? |
| sGTM tag returns 403 | Auth not configured | Set up GCP service account in Stape and grant `roles/pubsub.publisher` |
| sGTM tag returns 404 | Wrong topic name | Verify topic: `gcloud pubsub topics list --project=iampatterson` |
| Pub/Sub message published but not delivered | Push endpoint wrong | `gcloud pubsub subscriptions describe iampatterson-events-push` — check `pushConfig.pushEndpoint` |
| Cloud Run returns 400 on push | Message parse failure | Check Cloud Run logs. Common cause: double base64 encoding or missing `session_id` in payload |
| SSE connection drops after ~5 min | Cloud Run idle timeout | Verify `--timeout=3600` was set. Check keepalive heartbeats in Cloud Run logs |
| CORS errors in browser console | ALLOWED_ORIGINS mismatch | Update the env var to include the exact origin (protocol + domain, no trailing slash) |

### Useful diagnostic commands

```bash
# Cloud Run service details
gcloud run services describe event-stream --region=us-central1

# Cloud Run logs (last 5 minutes)
gcloud run services logs read event-stream --region=us-central1 --limit=50

# Pub/Sub subscription health
gcloud pubsub subscriptions describe iampatterson-events-push --project=iampatterson

# Check for undelivered messages (backlog)
gcloud pubsub subscriptions describe iampatterson-events-push \
  --project=iampatterson \
  --format='value(numUndeliveredMessages)'

# Pub/Sub dead letter messages (if configured)
gcloud pubsub subscriptions pull iampatterson-events-push --auto-ack --limit=5

# Test health endpoint
curl -s "${EVENT_STREAM_URL}/health" | python3 -m json.tool
```

### Session ID not present

If the `session_id` field is empty in Pub/Sub messages:

1. Check the browser has the `_iap_sid` cookie (DevTools → Application → Cookies)
2. Confirm sGTM can read it: in sGTM Preview, check if `getCookieValues('_iap_sid')` returns a value
3. The cookie is set client-side by `getSessionId()` in `src/lib/events/session.ts` — it requires the site to be accessed via HTTPS for the `Secure` flag to work
4. The sGTM domain `io.iampatterson.com` is same-origin, so it can read cookies set on `iampatterson.com`

---

## 11 — Resource Reference

### GCP Resource IDs

| Resource | Identifier |
|----------|-----------|
| GCP Project | `iampatterson` |
| Pub/Sub Topic | `iampatterson-events` |
| Pub/Sub Subscription | `iampatterson-events-push` |
| Cloud Run Service | `event-stream` (us-central1) |
| BigQuery Dataset | `iampatterson_raw` |
| BigQuery Table | `iampatterson_raw.events_raw` |
| Artifact Registry | `iampatterson-services` (us-central1) |

### GTM / Analytics IDs

| Resource | Identifier |
|----------|-----------|
| Web GTM Container | `GTM-MWHFMTZN` |
| Server GTM Container | `GTM-NTTKZFWD` |
| sGTM Domain | `io.iampatterson.com` |
| GA4 Measurement ID | `G-9M2G3RLHWF` |

### Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `ALLOWED_ORIGINS` | Cloud Run | `https://iampatterson-com.vercel.app,https://iampatterson.com` |
| `PORT` | Cloud Run | `8080` (default) |
| `NEXT_PUBLIC_EVENT_STREAM_URL` | Vercel | `https://event-stream-XXXXXXXXXX-uc.a.run.app` |
| `GCP_PROJECT_ID` | Local (setup scripts) | `iampatterson` |
| `EVENT_STREAM_URL` | Local (Pub/Sub setup) | Cloud Run service URL |

### Code Locations

| Component | Path |
|-----------|------|
| Cloud Run service | `infrastructure/cloud-run/event-stream/` |
| Dockerfile | `infrastructure/cloud-run/event-stream/Dockerfile` |
| Pub/Sub setup script | `infrastructure/pubsub/setup.sh` |
| BigQuery setup script | `infrastructure/bigquery/setup.sh` |
| BigQuery schema | `infrastructure/bigquery/schema.json` |
| sGTM config spec | `infrastructure/gtm/server-container.json` |
| Web GTM config spec | `infrastructure/gtm/web-container.json` |
| useEventStream hook | `src/hooks/useEventStream.ts` |
| Session cookie utils | `src/lib/events/session.ts` |
| Pipeline event types | `src/lib/events/pipeline-schema.ts` |

### Estimated Costs (Low Traffic)

| Resource | Free Tier | Estimated Monthly |
|----------|-----------|-------------------|
| Cloud Run (min 1 instance) | 2M requests free | ~$5-15 (1 warm instance) |
| Pub/Sub | 10GB free | ~$0 (low volume) |
| BigQuery | 10GB storage, 1TB queries free | ~$0 (low volume) |
| Artifact Registry | 500MB free | ~$0 |
| Stape sGTM | 10K requests/month free | Free tier until data generator runs |

---

## Post-Deployment Checklist

- [ ] BigQuery table exists and schema verified
- [ ] Cloud Run service deployed and `/health` returns `200 OK`
- [ ] Pub/Sub topic and push subscription created with correct endpoint
- [ ] sGTM Pub/Sub tag created, firing on all events, returning 200
- [ ] `NEXT_PUBLIC_EVENT_STREAM_URL` set in Vercel
- [ ] End-to-end test: browser interaction → SSE stream shows event within 5s
- [ ] CORS: allowed origins work, disallowed origins blocked
- [ ] Cloud Run logs show no errors
- [ ] (Pre-production) Pub/Sub OIDC auth implemented
- [ ] (Pre-production) CSP header added to `vercel.json`
