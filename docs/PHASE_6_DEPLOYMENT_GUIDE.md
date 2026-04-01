# Phase 6 Deployment Guide

This guide covers everything required to deploy the Phase 6 demo front-ends and connect them to the full measurement stack. It is organized into sequential steps — complete each section before moving to the next.

---

## Prerequisites

Before starting, confirm the following are operational from prior phases:

- [ ] **Vercel deployment** — site is live at `https://iampatterson-com.vercel.app/` and auto-deploys from `main`
- [ ] **Web GTM container** — `GTM-MWHFMTZN` is published and loading on the site
- [ ] **sGTM container** — `GTM-NTTKZFWD` is running on Stape at `io.iampatterson.com`
- [ ] **GA4 property** — `G-9M2G3RLHWF` is receiving events via sGTM
- [ ] **BigQuery** — `iampatterson.iampatterson_raw.events_raw` table exists with 51-column schema
- [ ] **Pub/Sub** — `iampatterson-events` topic exists with push subscription to Cloud Run SSE service
- [ ] **Cloud Run SSE service** — event-stream service is deployed and accepting connections
- [ ] **Cookiebot** — consent banner is functioning (CBID: `7258d666-e9f4-4a84-bfb4-634f84da84b6`)

---

## Step 1 — Verify Vercel Deployment

The frontend code is already merged to `main` and pushed. Vercel auto-deploys on push.

**Verify:**

1. Open `https://iampatterson-com.vercel.app/demo`
2. Confirm the demo landing page loads with three cards (The Tuna Shop, Tuna Subscription, Tuna Partnerships)
3. Navigate to each demo:
   - `/demo/ecommerce` — product listing with 6 products
   - `/demo/subscription` — plan selection with 3 tiers
   - `/demo/leadgen` — partnership landing page with inquiry form
4. Confirm the header "Demos" dropdown works on both desktop and mobile
5. Confirm the homepage CTAs ("Explore a live demo" in the hero, "Explore the demos" in the proof section) link to `/demo`

**If the deploy hasn't triggered:**

```bash
# Check Vercel deployment status
npx vercel ls

# Force a production deployment
npx vercel --prod
```

**No infrastructure changes needed.** The Next.js app handles all demo routes with static generation. No environment variables, API routes, or serverless functions are required for the demo pages.

---

## Step 2 — Import Web GTM Container

The updated container is pre-built as an importable JSON file. This adds all Phase 6 variables, triggers, and tags in one step.

**File:** `infrastructure/gtm/web-container-import.json`

**What it adds (on top of existing Phase 1 config):**
- 18 new Data Layer Variables (product_id, product_name, product_price, product_category, quantity, cart_total, item_count, order_id, order_total, products, plan_id, plan_name, plan_price, partnership_type, budget_range, company_name, lead_id, qualification_tier)
- 8 new Custom Event triggers (product_view, add_to_cart, begin_checkout, purchase, plan_select, trial_signup, form_complete, lead_qualify)
- 8 new GA4 Event tags, each using the shared_event_settings variable for base params + event-specific parameters
- New folder "Phase 6 - Demo Events" for organizational clarity

**Import steps:**

1. Open GTM at [tagmanager.google.com](https://tagmanager.google.com), select container `GTM-MWHFMTZN`
2. Go to **Admin** → **Import Container**
3. Click **Choose container file** and select `infrastructure/gtm/web-container-import.json`
4. Select **Existing workspace** → Default Workspace
5. Choose **Merge** → **Rename conflicting tags, triggers, and variables**
   - This preserves your existing Phase 1 config and adds the Phase 6 items alongside it
   - If the existing tags have been manually modified since Phase 1, "Rename" ensures nothing is overwritten
6. Review the preview — you should see 18 variables, 8 triggers, and 8 tags being added
7. Click **Confirm**

> **Note:** If you prefer a clean slate, you can choose **Overwrite** instead of Merge. This replaces the entire container with the import file, which includes all Phase 1 + Phase 6 config. Only do this if you haven't made manual changes to the live container beyond what's in the import file.

---

## Step 3 — Import sGTM Container

**File:** `infrastructure/gtm/server-container-import.json`

**What it adds (on top of existing config):**
- 1 new trigger: `ce - conversions` (fires on `purchase`, `trial_signup`, or `form_complete` events only)
- 2 new tags: `Meta CAPI - Simulated` and `Google Ads Enhanced Conversions - Simulated`
- New folder "Phase 6 - Simulated Ad Platforms"

**Import steps:**

1. Open the sGTM container (`GTM-NTTKZFWD`) on Stape
2. Go to **Admin** → **Import Container**
3. Select `infrastructure/gtm/server-container-import.json`
4. Choose **Merge** → **Rename conflicting tags, triggers, and variables**
5. Review and confirm

**Important — Simulated ad platform tags require manual template attachment:**

The two simulated tags (`Meta CAPI - Simulated` and `Google Ads Enhanced Conversions - Simulated`) are imported as placeholder tags of type `CUSTOM`. After import, you need to:

1. Open each tag in the sGTM workspace
2. Create or attach a custom sGTM template (sandboxed JavaScript)
3. The template should read `getAllEventData()` and log the simulated payload to the sGTM console via `logToConsole()`

**Meta CAPI template behavior:**
- Maps event names: `purchase` → `Purchase`, `add_to_cart` → `AddToCart`, `begin_checkout` → `InitiateCheckout`, `trial_signup` → `StartTrial`, `form_complete` → `Lead`
- Builds the Meta CAPI payload structure (event_name, event_time, event_source_url, user_data with hashed placeholders, custom_data with value/currency)
- Logs with prefix `[SIMULATED] Meta CAPI:`
- **Does not make any HTTP request**

**Google Ads EC template behavior:**
- Builds Enhanced Conversions payload (conversion_action, conversion_value, currency_code, order_id, hashed user_data)
- Logs with prefix `[SIMULATED] Google Ads EC:`
- **Does not make any HTTP request**

> **Why simulate?** There are no real Meta or Google Ads accounts connected to this demo. The simulation shows prospects exactly what payload would be sent to each platform, making the server-side delivery visible in the flip-the-card overlay.

**No changes needed to existing sGTM tags.** The three existing tags (GA4 Forwarding, BigQuery Write, Pub/Sub Publish) fire on "All GA4 Events" and will automatically process all new demo events.

---

## Step 4 — Publish GTM Containers

After importing both containers:

1. **Web GTM (`GTM-MWHFMTZN`)**
   - Open the workspace in GTM
   - Review the container summary: should show the newly imported items (18 variables, 8 triggers, 8 tags)
   - Click **Submit** → name the version "Phase 6 — Demo event tags"
   - **Publish**

2. **sGTM (`GTM-NTTKZFWD`)**
   - Open the workspace in sGTM on Stape
   - Review: should show 1 new trigger + 2 new tags
   - Click **Submit** → name the version "Phase 6 — Demo triggers + simulated ad tags"
   - **Publish**

> **Important:** Publish web GTM first. The web container pushes events to the data layer, which are then sent to sGTM. If sGTM publishes first with triggers for events that the web container isn't sending yet, nothing breaks — the triggers simply never fire until the web container catches up.

---

## Step 5 — Verify the Event Pipeline End-to-End

After both containers are published, test the full pipeline:

### 5a. Browser → GTM → sGTM

1. Open `https://iampatterson-com.vercel.app/demo/ecommerce` in a new incognito window
2. Accept the Cookiebot consent banner (grant all categories)
3. Open browser DevTools → Console
4. Check `window.dataLayer` for `page_view` events with `page_path: "/demo/ecommerce"`
5. Click on a product (e.g., Tuna Plush Toy)
6. Verify `product_view` appears in the data layer with correct `product_id`, `product_name`, `product_price`, `product_category`
7. Click "Add to Cart"
8. Verify `add_to_cart` appears with `quantity: 1`
9. Navigate to cart → checkout
10. Verify `begin_checkout` appears once with `cart_total` and `item_count`
11. Click "Complete Purchase"
12. Verify `purchase` appears with `order_id`, `order_total`, `products`

### 5b. sGTM → GA4

1. Open GA4 Realtime report (`G-9M2G3RLHWF`)
2. Confirm demo events appear: `product_view`, `add_to_cart`, `purchase`, etc.
3. Verify event parameters are populated (click into an event to see parameter values)

### 5c. sGTM → BigQuery

1. Open BigQuery console → `iampatterson.iampatterson_raw.events_raw`
2. Run:
   ```sql
   SELECT event_name, product_id, product_name, order_id, order_total, plan_id, partnership_type
   FROM `iampatterson.iampatterson_raw.events_raw`
   WHERE received_timestamp > UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE))
   ORDER BY received_timestamp DESC
   LIMIT 20
   ```
3. Confirm your demo events appear with populated demo-specific columns

### 5d. sGTM → Pub/Sub → Flip-the-Card Overlay

1. Open `https://iampatterson-com.vercel.app/demo/ecommerce`
2. Click the flip-the-card toggle (bottom-right button)
3. Interact with products (view, add to cart, checkout, purchase)
4. Verify events appear in the overlay timeline in real time
5. Click an event to see the detail panel — confirm routing destinations show:
   - GA4: sent
   - BigQuery: sent
   - Meta CAPI: simulated (if consent_marketing is granted)
   - Google Ads: simulated (if consent_marketing is granted)
6. Repeat for subscription demo (`/demo/subscription`) and lead gen demo (`/demo/leadgen`)

### 5e. Subscription Demo

1. Navigate to `/demo/subscription`
2. Click "Start Free Trial" on any plan → verify `plan_select` fires
3. Submit the signup form → verify `trial_signup` fires
4. On the dashboard, click Upgrade/Downgrade/Cancel → verify `click_cta` fires

### 5f. Lead Gen Demo

1. Navigate to `/demo/leadgen`
2. Click into the first form field → verify `form_start` fires (once)
3. Tab through fields → verify `form_field_focus` fires per field
4. Submit the form → verify `form_complete` fires with `partnership_type`, `budget_range`, `company_name`
5. Immediately after, verify `lead_qualify` fires with `lead_id`, `qualification_tier`

---

## Step 6 — Verify Spec Files Are Up to Date

The container spec files and import files in the repo have already been updated with Phase 6 additions:

- `infrastructure/gtm/web-container.json` — 18 new variables, 8 triggers, 8 tags added
- `infrastructure/gtm/server-container.json` — `phase6Additions` stub replaced with actual triggers + simulated tags
- `infrastructure/gtm/web-container-import.json` — importable JSON with all Phase 1 + Phase 6 config
- `infrastructure/gtm/server-container-import.json` — importable JSON with all config including simulated tags

No further spec file changes needed unless you make manual modifications in the GTM UI after import.

---

## Step 7 — Update Phase Status

After all steps are verified:

1. Mark the final two Phase 6 deliverables as complete in `docs/PHASE_STATUS.md`:
   ```
   - ✅ YYYY-MM-DD — Web GTM container updated with demo event tags
   - ✅ YYYY-MM-DD — sGTM container updated with demo triggers, simulated Meta CAPI and Google Ads tags
   ```

2. Update the phase status line:
   ```
   > **Current Phase: 6 — Three Demo Front-Ends** (all deliverables complete)
   ```

3. Update `CLAUDE.md` current phase:
   ```
   **Phase 6 — Three Demo Front-Ends** (all deliverables complete)
   ```

---

## Rollback Procedures

### Frontend rollback
If the demo pages cause issues on the production site:
- Vercel supports instant rollback via the dashboard → Deployments → click a previous deployment → Promote to Production
- No code revert needed for an instant rollback

### GTM rollback
If the new tags cause issues (e.g., unexpected errors, performance degradation):
- Open GTM → Versions → select the previous version → Publish
- This reverts the live container to pre-Phase-6 state immediately
- Same process for both web GTM and sGTM

### BigQuery
No schema changes needed — all 51 columns already exist from Phase 5. The new demo events simply populate columns that were previously only filled by the data generator.

---

## Reference: Event-to-Column Mapping

This maps frontend events to the BigQuery columns they populate in `events_raw`:

| Event | Key Columns Populated |
|---|---|
| `product_view` | `product_id`, `product_name`, `product_price`, `product_category` |
| `add_to_cart` | `product_id`, `product_name`, `product_price`, `quantity` |
| `begin_checkout` | `cart_total`, `item_count` |
| `purchase` | `order_id`, `order_total`, `item_count`, `products` |
| `plan_select` | `plan_id`, `plan_name`, `plan_price` |
| `trial_signup` | `plan_id`, `plan_name`, `plan_price` |
| `form_complete` | `form_name`, `partnership_type`, `budget_range`, `company_name` |
| `lead_qualify` | `lead_id`, `qualification_tier`, `partnership_type`, `budget_range` |

All events also populate the base columns: `event_name`, `timestamp`, `received_timestamp`, `session_id`, `iap_session_id`, `page_path`, `page_title`, `page_location`, `consent_analytics`, `consent_marketing`, `consent_preferences`, `iap_source`.

---

## Reference: Container IDs and URLs

| Resource | Identifier |
|---|---|
| Web GTM Container | `GTM-MWHFMTZN` |
| sGTM Container | `GTM-NTTKZFWD` |
| sGTM Custom Domain | `io.iampatterson.com` |
| GA4 Measurement ID | `G-9M2G3RLHWF` |
| Cookiebot CBID | `7258d666-e9f4-4a84-bfb4-634f84da84b6` |
| BigQuery Table | `iampatterson.iampatterson_raw.events_raw` |
| Pub/Sub Topic | `projects/iampatterson/topics/iampatterson-events` |
| Production URL | `https://iampatterson-com.vercel.app/` |
| Vercel Project | `iampatterson-com` |
