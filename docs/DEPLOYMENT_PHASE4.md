# Phase 4 — Data Generator Deployment Guide

> **Scope:** Deploy the background data generator service to Cloud Run, run the initial historical backfill for all three business models, and configure Cloud Scheduler for ongoing daily generation.
>
> **Prerequisites:** Phase 2 infrastructure is deployed and operational (Cloud Run, Pub/Sub, BigQuery, sGTM). See `docs/DEPLOYMENT_PHASE2.md` if any Phase 2 resources need setup.

---

## Table of Contents

1. [Prerequisites](#1--prerequisites)
2. [Architecture Recap](#2--architecture-recap)
3. [Step 1 — Build and Push the Container Image](#3--step-1--build-and-push-the-container-image)
4. [Step 2 — Deploy to Cloud Run](#4--step-2--deploy-to-cloud-run)
5. [Step 3 — Verify the Service](#5--step-3--verify-the-service)
6. [Step 4 — Run Dry-Run Tests](#6--step-4--run-dry-run-tests)
7. [Step 5 — Run the Historical Backfill](#7--step-5--run-the-historical-backfill)
8. [Step 6 — Configure Cloud Scheduler](#8--step-6--configure-cloud-scheduler)
9. [Step 7 — Verify Data in BigQuery](#9--step-7--verify-data-in-bigquery)
10. [Stape Plan Considerations](#10--stape-plan-considerations)
11. [Troubleshooting](#11--troubleshooting)
12. [Resource Reference](#12--resource-reference)

---

## 1 — Prerequisites

### Tools Required

| Tool | Purpose |
|------|---------|
| `gcloud` CLI | GCP resource management, Cloud Run deployment |
| `docker` | Build container image (or use Cloud Build) |
| `curl` | Verify endpoints |

### Authentication

```bash
gcloud auth login
gcloud config set project iampatterson
gcloud config get-value project
# → iampatterson
```

### Verify Existing Infrastructure

These resources must exist from Phase 2:

```bash
# sGTM is reachable
curl -sI https://io.iampatterson.com | head -3

# Artifact Registry repository exists
gcloud artifacts repositories describe iampatterson-services \
  --location=us-central1 --format='value(name)'

# BigQuery table exists
bq show --project_id=iampatterson iampatterson_raw.events_raw > /dev/null && echo "OK"
```

---

## 2 — Architecture Recap

```
Cloud Scheduler (cron)
  → POST /generate { model: "ecommerce" }
  → POST /generate { model: "subscription" }
  → POST /generate { model: "leadgen" }
    ↓
Cloud Run: data-generator
  → Generates synthetic events (sessions, funnels, lifecycle)
  → Generates ad platform spend/impressions/clicks
    ↓
POST /g/collect (gtag.js format) → sGTM
  → https://io.iampatterson.com/g/collect
    ↓
sGTM GA4 Client (io.iampatterson.com)
  ├─ GA4 Forwarding
  ├─ BigQuery Write → iampatterson_raw.events_raw
  └─ Pub/Sub Publish → event-stream → SSE → browser overlay
```

The data generator mimics browser traffic by sending events to sGTM's `/g/collect` endpoint in the same URL-encoded format that gtag.js uses. The sGTM GA4 client parses them identically to real browser hits, firing all configured tags (GA4, BigQuery, Pub/Sub). No API secret or special sGTM configuration is needed.

---

## 3 — Step 1 — Build and Push the Container Image

### Option A — Local Docker build

```bash
cd infrastructure/cloud-run/data-generator

# Configure Docker for Artifact Registry (one-time)
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build (use --platform on Apple Silicon)
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/iampatterson/iampatterson-services/data-generator:v1 .

# Push
docker push us-central1-docker.pkg.dev/iampatterson/iampatterson-services/data-generator:v1
```

### Option B — Cloud Build (no local Docker needed)

```bash
cd infrastructure/cloud-run/data-generator

gcloud builds submit \
  --tag us-central1-docker.pkg.dev/iampatterson/iampatterson-services/data-generator:v1
```

### Verify the image

```bash
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/iampatterson/iampatterson-services/data-generator \
  --format='table(package, version, createTime)'
```

---

## 4 — Step 2 — Deploy to Cloud Run

```bash
gcloud run deploy data-generator \
  --image=us-central1-docker.pkg.dev/iampatterson/iampatterson-services/data-generator:v1 \
  --region=us-central1 \
  --platform=managed \
  --port=8080 \
  --no-allow-unauthenticated \
  --set-env-vars='SGTM_URL=https://io.iampatterson.com,GA4_MEASUREMENT_ID=G-9M2G3RLHWF' \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=3600 \
  --cpu=2 \
  --memory=1Gi
```

**Key flags explained:**

| Flag | Why |
|------|-----|
| `--no-allow-unauthenticated` | This service is triggered by Cloud Scheduler and manual invocations only — no public access needed. |
| `--min-instances=0` | Scale to zero when idle. Unlike event-stream, this doesn't maintain long-lived connections. |
| `--max-instances=3` | Backfill can be CPU-intensive. Cap at 3 to control costs. |
| `--timeout=3600` | Backfill for 18 months of data takes several minutes. Allow up to 60 min. |
| `--cpu=2 --memory=1Gi` | Backfill generates thousands of events in memory before sending. Needs headroom. |

### Capture the service URL

```bash
DATA_GEN_URL=$(gcloud run services describe data-generator \
  --region=us-central1 --format='value(status.url)')
echo $DATA_GEN_URL
```

### Grant your identity invoke permissions (for manual testing)

```bash
# Allow your user account to call the service
gcloud run services add-iam-policy-binding data-generator \
  --region=us-central1 \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/run.invoker"
```

---

## 5 — Step 3 — Verify the Service

```bash
# Health check (use --header for authenticated requests)
curl -s -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "${DATA_GEN_URL}/health"
# → {"status":"ok","timestamp":"2026-03-28T..."}

# Stats (should show zeroes initially)
curl -s -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "${DATA_GEN_URL}/stats"
# → {"lastRun":null,"totalEventsGenerated":0,"totalEventsSent":0,"totalErrors":0,"isRunning":false}
```

---

## 6 — Step 4 — Run Dry-Run Tests

Dry-run mode generates events locally without sending them to sGTM. Use this to verify the generator works before hitting your sGTM endpoint.

```bash
AUTH="Authorization: Bearer $(gcloud auth print-identity-token)"

# Test each business model
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "${DATA_GEN_URL}/generate" \
  -d '{"model":"ecommerce","date":"2025-06-15","dryRun":true}' | jq '.stats'

curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "${DATA_GEN_URL}/generate" \
  -d '{"model":"subscription","date":"2025-06-15","dryRun":true}' | jq '.stats'

curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "${DATA_GEN_URL}/generate" \
  -d '{"model":"leadgen","date":"2025-06-15","dryRun":true}' | jq '.stats'
```

**Expected output** (ecommerce example):

```json
{
  "totalSessions": 165,
  "totalEvents": 572,
  "totalAdRecords": 7,
  "dateRange": { "start": "2025-06-15", "end": "2025-06-15" },
  "eventBreakdown": {
    "page_view": 165,
    "product_view": 330,
    "add_to_cart": 28,
    "begin_checkout": 15,
    "purchase": 11
  }
}
```

Verify:
- `totalSessions` is in the hundreds (not single digits — would indicate the session count bug)
- `eventBreakdown` contains the expected event types for each model
- Subscription model includes `subscription_renewal` and `subscription_churn` events
- Lead gen model includes `form_start`, `form_complete`, and `lead_qualify` events

### Test a small live send (single day, single model)

```bash
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "${DATA_GEN_URL}/generate" \
  -d '{"model":"ecommerce","date":"2025-06-15"}' | jq '{success, sent: .sendResult.sent, failed: .sendResult.failed}'
# → {"success":true,"sent":572,"failed":0}
```

If `failed > 0`, check the `errors` array and see [Troubleshooting](#11--troubleshooting).

---

## 7 — Step 5 — Run the Historical Backfill

The backfill generates 18 months of synthetic data for each business model. This is the most resource-intensive operation — it produces tens of thousands of events and sends them to sGTM via `/g/collect`.

### Important: Stape rate limits

Before running a full backfill, check your Stape plan. The free tier allows 10,000 requests/month. A full 18-month backfill for all three models will generate roughly **100,000+ events**. You need a paid Stape plan (or run the backfill with `dryRun: true` until you're ready to upgrade).

### Run backfill per model

Run each model separately. The backfill can take several minutes per model.

```bash
AUTH="Authorization: Bearer $(gcloud auth print-identity-token)"

# E-commerce (largest volume)
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  --max-time 3600 \
  "${DATA_GEN_URL}/backfill" \
  -d '{"model":"ecommerce","months":18}' | jq '{success, events: .stats.totalEvents, adRecords: .stats.totalAdRecords, range: .stats.dateRange, sent: .sendResult.sent, failed: .sendResult.failed}'

# Subscription
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  --max-time 3600 \
  "${DATA_GEN_URL}/backfill" \
  -d '{"model":"subscription","months":18}' | jq '{success, events: .stats.totalEvents, adRecords: .stats.totalAdRecords, range: .stats.dateRange, sent: .sendResult.sent, failed: .sendResult.failed}'

# Lead gen
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  --max-time 3600 \
  "${DATA_GEN_URL}/backfill" \
  -d '{"model":"leadgen","months":18}' | jq '{success, events: .stats.totalEvents, adRecords: .stats.totalAdRecords, range: .stats.dateRange, sent: .sendResult.sent, failed: .sendResult.failed}'
```

### Alternative: Shorter backfill for testing

If you want to test the pipeline before committing to 18 months:

```bash
# 3-month backfill (much faster)
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  "${DATA_GEN_URL}/backfill" \
  -d '{"model":"ecommerce","months":3}' | jq '.stats'
```

### Monitor progress

While the backfill runs, check stats from another terminal:

```bash
curl -s -H "$AUTH" "${DATA_GEN_URL}/stats" | jq .
```

And check Cloud Run logs:

```bash
gcloud run services logs read data-generator --region=us-central1 --limit=20
```

---

## 8 — Step 6 — Configure Cloud Scheduler

Cloud Scheduler triggers the data generator daily to keep the demo data fresh.

### Enable the Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

### Create a service account for the scheduler

```bash
# Create service account
gcloud iam service-accounts create data-gen-scheduler \
  --display-name="Cloud Scheduler → Data Generator"

# Grant it permission to invoke the Cloud Run service
gcloud run services add-iam-policy-binding data-generator \
  --region=us-central1 \
  --member="serviceAccount:data-gen-scheduler@iampatterson.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### Create the scheduler jobs

One job per business model, staggered to avoid overloading sGTM:

```bash
DATA_GEN_URL=$(gcloud run services describe data-generator \
  --region=us-central1 --format='value(status.url)')

# E-commerce: runs daily at 02:00 UTC
gcloud scheduler jobs create http data-gen-ecommerce \
  --location=us-central1 \
  --schedule="0 2 * * *" \
  --time-zone="UTC" \
  --uri="${DATA_GEN_URL}/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"model":"ecommerce"}' \
  --oidc-service-account-email=data-gen-scheduler@iampatterson.iam.gserviceaccount.com \
  --oidc-token-audience="${DATA_GEN_URL}" \
  --attempt-deadline=1800s

# Subscription: runs daily at 02:30 UTC
gcloud scheduler jobs create http data-gen-subscription \
  --location=us-central1 \
  --schedule="30 2 * * *" \
  --time-zone="UTC" \
  --uri="${DATA_GEN_URL}/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"model":"subscription"}' \
  --oidc-service-account-email=data-gen-scheduler@iampatterson.iam.gserviceaccount.com \
  --oidc-token-audience="${DATA_GEN_URL}" \
  --attempt-deadline=1800s

# Lead gen: runs daily at 03:00 UTC
gcloud scheduler jobs create http data-gen-leadgen \
  --location=us-central1 \
  --schedule="0 3 * * *" \
  --time-zone="UTC" \
  --uri="${DATA_GEN_URL}/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"model":"leadgen"}' \
  --oidc-service-account-email=data-gen-scheduler@iampatterson.iam.gserviceaccount.com \
  --oidc-token-audience="${DATA_GEN_URL}" \
  --attempt-deadline=1800s
```

### Verify the scheduler jobs

```bash
gcloud scheduler jobs list --location=us-central1 \
  --format='table(name, schedule, state, lastAttemptTime)'
```

### Manually trigger a job to test

```bash
gcloud scheduler jobs run data-gen-ecommerce --location=us-central1
```

Then check:

```bash
# Job execution status
gcloud scheduler jobs describe data-gen-ecommerce \
  --location=us-central1 \
  --format='value(lastAttemptTime, status.latestExecution.status)'

# Cloud Run logs
gcloud run services logs read data-generator --region=us-central1 --limit=10

# Data generator stats
curl -s -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "${DATA_GEN_URL}/stats" | jq .
```

---

## 9 — Step 7 — Verify Data in BigQuery

After the backfill (or a single-day generation), confirm events landed in BigQuery.

```bash
# Total event count
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) as total_events FROM `iampatterson.iampatterson_raw.events_raw`'

# Events by event_name
bq query --use_legacy_sql=false \
  'SELECT event_name, COUNT(*) as count
   FROM `iampatterson.iampatterson_raw.events_raw`
   GROUP BY event_name
   ORDER BY count DESC
   LIMIT 20'

# Events by date (verify backfill range)
bq query --use_legacy_sql=false \
  'SELECT DATE(TIMESTAMP_MILLIS(received_timestamp)) as event_date, COUNT(*) as count
   FROM `iampatterson.iampatterson_raw.events_raw`
   GROUP BY event_date
   ORDER BY event_date
   LIMIT 30'

# Check for demo-specific events
bq query --use_legacy_sql=false \
  'SELECT event_name, COUNT(*) as count
   FROM `iampatterson.iampatterson_raw.events_raw`
   WHERE event_name IN ("product_view", "add_to_cart", "purchase",
                         "trial_signup", "subscription_renewal", "subscription_churn",
                         "form_complete", "lead_qualify")
   GROUP BY event_name
   ORDER BY count DESC'
```

**Expected:** You should see events spanning the full backfill date range, with business-model-specific events present.

---

## 10 — Stape Plan Considerations

The data generator sends events through sGTM on Stape. Plan limits apply:

| Stape Plan | Monthly Requests | Backfill Impact |
|------------|-----------------|-----------------|
| Free | 10,000 | Not enough for a full backfill |
| Starter ($20/mo) | 500,000 | Sufficient for backfill + ongoing |
| Business ($40/mo) | 2,000,000 | Comfortable headroom |

**Recommendation:** Upgrade to at least the Starter plan before running the backfill. The ongoing daily generation across three models adds roughly 1,000-2,000 events/day, well within the Starter limit.

If you want to test the generator before upgrading, use `"dryRun": true` on all requests. This generates events and returns stats without sending anything to sGTM.

---

## 11 — Troubleshooting

### Common issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `sendResult.failed > 0` with 400 errors | sGTM GA4 client can't parse the hit | Check that the image is built from the latest code using `/g/collect` format (not the old `/mp/collect` JSON format). |
| 403 on Cloud Run endpoints | Missing OIDC auth | Ensure the calling identity has `roles/run.invoker`. For manual calls, use the `Authorization: Bearer` header. |
| Backfill timeout | Cloud Run request deadline exceeded | Ensure `--timeout=3600` was set. For very large backfills, reduce `months`. |
| Events not in BigQuery | sGTM BigQuery tag not firing on generated events | Check sGTM Preview — verify the "Write to BigQuery" tag fires on `/g/collect` hits. The `ep.iap_source=true` parameter should be present. |
| Events in BigQuery but not in SSE stream | sGTM Pub/Sub tag not matching generated events | Check the Pub/Sub tag trigger — it should fire on all GA4 events. Generated events arrive as standard GA4 `/g/collect` hits. |
| `isRunning: true` stuck | Previous request crashed mid-generation | Redeploy the service: `gcloud run services update data-generator --region=us-central1` |
| Low session counts in dry-run | Stale image with the hour-of-day bug | Rebuild and redeploy with the latest code from the `phase/4-background-data-generator` branch. |

### Diagnostic commands

```bash
# Cloud Run service details
gcloud run services describe data-generator --region=us-central1

# Recent logs
gcloud run services logs read data-generator --region=us-central1 --limit=50

# Scheduler job history
gcloud scheduler jobs describe data-gen-ecommerce --location=us-central1

# Current stats
curl -s -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "$(gcloud run services describe data-generator --region=us-central1 --format='value(status.url)')/stats" | jq .
```

---

## 12 — Resource Reference

### New Resources (Phase 4)

| Resource | Identifier |
|----------|-----------|
| Cloud Run Service | `data-generator` (us-central1) |
| Container Image | `us-central1-docker.pkg.dev/iampatterson/iampatterson-services/data-generator:v1` |
| Scheduler Job (ecommerce) | `data-gen-ecommerce` (us-central1, `0 2 * * *`) |
| Scheduler Job (subscription) | `data-gen-subscription` (us-central1, `30 2 * * *`) |
| Scheduler Job (lead gen) | `data-gen-leadgen` (us-central1, `0 3 * * *`) |
| Service Account | `data-gen-scheduler@iampatterson.iam.gserviceaccount.com` |

### Environment Variables

| Variable | Value | Source |
|----------|-------|--------|
| `PORT` | `8080` | Default in Dockerfile |
| `SGTM_URL` | `https://io.iampatterson.com` | Cloud Run env var |
| `GA4_MEASUREMENT_ID` | `G-9M2G3RLHWF` | Cloud Run env var |

No API secret is needed — the `/g/collect` format doesn't require one. Events are sent in the same URL-encoded format that gtag.js uses from the browser.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check |
| `GET` | `/stats` | Cumulative generation stats |
| `POST` | `/generate` | Generate events for one day |
| `POST` | `/backfill` | Generate historical backfill |

### Request Body Reference

**POST /generate:**
```json
{
  "model": "ecommerce | subscription | leadgen",
  "date": "2025-06-15",
  "dryRun": false
}
```

**POST /backfill:**
```json
{
  "model": "ecommerce | subscription | leadgen",
  "months": 18,
  "endDate": "2026-03-28",
  "dryRun": false
}
```

All fields are optional with sensible defaults (model: `ecommerce`, date: today, months: 18, dryRun: false).

### Code Locations

| Component | Path |
|-----------|------|
| Data generator service | `infrastructure/cloud-run/data-generator/` |
| Server & endpoints | `infrastructure/cloud-run/data-generator/src/server.ts` |
| Transport (`/g/collect` client) | `infrastructure/cloud-run/data-generator/src/transport.ts` |
| Business model profiles | `infrastructure/cloud-run/data-generator/src/profiles.ts` |
| Generator orchestrator | `infrastructure/cloud-run/data-generator/src/generator.ts` |
| E-commerce engine | `infrastructure/cloud-run/data-generator/src/engines/ecommerce.ts` |
| Subscription engine | `infrastructure/cloud-run/data-generator/src/engines/subscription.ts` |
| Lead gen engine | `infrastructure/cloud-run/data-generator/src/engines/leadgen.ts` |

---

## Post-Deployment Checklist

- [ ] Container image built and pushed to Artifact Registry
- [ ] Cloud Run service deployed, `/health` returns 200
- [ ] Dry-run tests pass for all three models
- [ ] Stape plan upgraded (if running live sends)
- [ ] Single-day live test succeeds (`sendResult.failed: 0`)
- [ ] Historical backfill completed for all three models
- [ ] Events visible in BigQuery with correct date range
- [ ] Cloud Scheduler jobs created for all three models
- [ ] Manual scheduler trigger succeeds
- [ ] `/stats` endpoint shows non-zero `totalEventsSent`
