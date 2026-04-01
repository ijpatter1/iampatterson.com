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

## Step 2 — Add Demo Data Layer Variables to Web GTM

The demo events push additional parameters to the data layer that GTM needs to read. Open the web GTM container (`GTM-MWHFMTZN`) at [tagmanager.google.com](https://tagmanager.google.com) and add these Data Layer Variables:

| Variable Name | Data Layer Variable Name | Type |
|---|---|---|
| `dlv - product_id` | `product_id` | Data Layer Variable |
| `dlv - product_name` | `product_name` | Data Layer Variable |
| `dlv - product_price` | `product_price` | Data Layer Variable |
| `dlv - product_category` | `product_category` | Data Layer Variable |
| `dlv - quantity` | `quantity` | Data Layer Variable |
| `dlv - cart_total` | `cart_total` | Data Layer Variable |
| `dlv - item_count` | `item_count` | Data Layer Variable |
| `dlv - order_id` | `order_id` | Data Layer Variable |
| `dlv - order_total` | `order_total` | Data Layer Variable |
| `dlv - products` | `products` | Data Layer Variable |
| `dlv - plan_id` | `plan_id` | Data Layer Variable |
| `dlv - plan_name` | `plan_name` | Data Layer Variable |
| `dlv - plan_price` | `plan_price` | Data Layer Variable |
| `dlv - partnership_type` | `partnership_type` | Data Layer Variable |
| `dlv - budget_range` | `budget_range` | Data Layer Variable |
| `dlv - company_name` | `company_name` | Data Layer Variable |
| `dlv - lead_id` | `lead_id` | Data Layer Variable |
| `dlv - qualification_tier` | `qualification_tier` | Data Layer Variable |

These variables are used by the GA4 event tags in the next step to pass event-specific parameters through to sGTM.

---

## Step 3 — Add Demo Triggers to Web GTM

Add 7 Custom Event triggers to the web GTM container:

| Trigger Name | Event Name | Notes |
|---|---|---|
| `ce - product_view` | `product_view` | Fires when a product detail page loads |
| `ce - add_to_cart` | `add_to_cart` | Fires when "Add to Cart" is clicked |
| `ce - begin_checkout` | `begin_checkout` | Fires once when checkout page loads with items |
| `ce - purchase` | `purchase` | Fires on "Complete Purchase" submit |
| `ce - plan_select` | `plan_select` | Fires when a subscription plan CTA is clicked |
| `ce - trial_signup` | `trial_signup` | Fires on trial signup form submit |
| `ce - form_complete` | `form_complete` | Fires on partnership inquiry form submit |
| `ce - lead_qualify` | `lead_qualify` | Fires immediately after form_complete with qualification data |

Each trigger uses the exact `event` value pushed to the data layer by the frontend code.

---

## Step 4 — Add Demo GA4 Event Tags to Web GTM

Add 7 GA4 Event tags, one per trigger. Each tag follows the same pattern as the existing Phase 1 tags — the event name matches the trigger, and all relevant parameters are passed via the data layer variables.

### E-Commerce Tags

**GA4 - product_view**
- Type: GA4 Event
- Event Name: `product_view`
- Firing Trigger: `ce - product_view`
- Consent: `analytics_storage` required
- Parameters:

| Parameter Name | Value |
|---|---|
| `iap_source` | `{{dlv - iap_source}}` |
| `timestamp` | `{{dlv - timestamp}}` |
| `session_id` | `{{dlv - session_id}}` |
| `page_path` | `{{dlv - page_path}}` |
| `page_title` | `{{dlv - page_title}}` |
| `product_id` | `{{dlv - product_id}}` |
| `product_name` | `{{dlv - product_name}}` |
| `product_price` | `{{dlv - product_price}}` |
| `product_category` | `{{dlv - product_category}}` |
| `consent_analytics` | `{{dlv - consent_analytics}}` |
| `consent_marketing` | `{{dlv - consent_marketing}}` |
| `consent_preferences` | `{{dlv - consent_preferences}}` |

**GA4 - add_to_cart**
- Firing Trigger: `ce - add_to_cart`
- Consent: `analytics_storage` required
- Parameters: base fields (iap_source, timestamp, session_id, page_path, page_title, consent_*) plus:

| Parameter Name | Value |
|---|---|
| `product_id` | `{{dlv - product_id}}` |
| `product_name` | `{{dlv - product_name}}` |
| `product_price` | `{{dlv - product_price}}` |
| `quantity` | `{{dlv - quantity}}` |

**GA4 - begin_checkout**
- Firing Trigger: `ce - begin_checkout`
- Consent: `analytics_storage` required
- Parameters: base fields plus:

| Parameter Name | Value |
|---|---|
| `cart_total` | `{{dlv - cart_total}}` |
| `item_count` | `{{dlv - item_count}}` |

**GA4 - purchase**
- Firing Trigger: `ce - purchase`
- Consent: `analytics_storage` required
- Parameters: base fields plus:

| Parameter Name | Value |
|---|---|
| `order_id` | `{{dlv - order_id}}` |
| `order_total` | `{{dlv - order_total}}` |
| `item_count` | `{{dlv - item_count}}` |
| `products` | `{{dlv - products}}` |

### Subscription Tags

**GA4 - plan_select**
- Firing Trigger: `ce - plan_select`
- Consent: `analytics_storage` required
- Parameters: base fields plus:

| Parameter Name | Value |
|---|---|
| `plan_id` | `{{dlv - plan_id}}` |
| `plan_name` | `{{dlv - plan_name}}` |
| `plan_price` | `{{dlv - plan_price}}` |

**GA4 - trial_signup**
- Firing Trigger: `ce - trial_signup`
- Consent: `analytics_storage` required
- Parameters: base fields plus:

| Parameter Name | Value |
|---|---|
| `plan_id` | `{{dlv - plan_id}}` |
| `plan_name` | `{{dlv - plan_name}}` |
| `plan_price` | `{{dlv - plan_price}}` |

### Lead Gen Tags

**GA4 - form_complete**
- Firing Trigger: `ce - form_complete`
- Consent: `analytics_storage` required
- Parameters: base fields plus:

| Parameter Name | Value |
|---|---|
| `form_name` | `{{dlv - form_name}}` |
| `partnership_type` | `{{dlv - partnership_type}}` |
| `budget_range` | `{{dlv - budget_range}}` |
| `company_name` | `{{dlv - company_name}}` |

**GA4 - lead_qualify**
- Firing Trigger: `ce - lead_qualify`
- Consent: `analytics_storage` required
- Parameters: base fields plus:

| Parameter Name | Value |
|---|---|
| `lead_id` | `{{dlv - lead_id}}` |
| `qualification_tier` | `{{dlv - qualification_tier}}` |
| `partnership_type` | `{{dlv - partnership_type}}` |
| `budget_range` | `{{dlv - budget_range}}` |

> **Note:** "Base fields" in all tags above means: `iap_source`, `timestamp`, `session_id`, `page_path`, `page_title`, `consent_analytics`, `consent_marketing`, `consent_preferences`. These are identical across all tags and use the same data layer variables as the Phase 1 tags.

---

## Step 5 — Add Demo Triggers to sGTM

Open the sGTM container (`GTM-NTTKZFWD`) on Stape and add 7 Custom Event triggers. These match the web container triggers but run server-side:

| Trigger Name | Event Name | Filter |
|---|---|---|
| `ce - product_view` | `product_view` | Client Name contains "GA4" |
| `ce - add_to_cart` | `add_to_cart` | Client Name contains "GA4" |
| `ce - begin_checkout` | `begin_checkout` | Client Name contains "GA4" |
| `ce - purchase` | `purchase` | Client Name contains "GA4" |
| `ce - plan_select` | `plan_select` | Client Name contains "GA4" |
| `ce - trial_signup` | `trial_signup` | Client Name contains "GA4" |
| `ce - form_complete` | `form_complete` | Client Name contains "GA4" |
| `ce - lead_qualify` | `lead_qualify` | Client Name contains "GA4" |

**No changes needed to existing sGTM tags.** The three existing tags fire on "All GA4 Events" and will automatically process the new demo events:

- **GA4 - Forwarding** → forwards to GA4 via Measurement Protocol (all event params included)
- **BigQuery - Write All Events** → writes to `events_raw` via `getAllEventData()` (all demo columns already exist in schema)
- **Pub/Sub - Publish All Events** → publishes to `iampatterson-events` topic (drives the flip-the-card overlay)

The demo-specific triggers are for the two new simulated tags in the next step, and for future use if event-specific routing logic is needed.

---

## Step 6 — Add Simulated Ad Platform Tags to sGTM

These tags demonstrate what real Meta CAPI and Google Ads Enhanced Conversions payloads would look like, without actually sending data to those platforms. They are visible in the flip-the-card overlay's routing section.

### Meta CAPI — Simulated

Create a **Custom HTML tag** (or Custom Template if you prefer) that logs the Meta Conversions API payload:

- **Tag Name:** `Meta CAPI - Simulated`
- **Firing Triggers:** `ce - purchase`, `ce - trial_signup`, `ce - form_complete` (conversion events only)
- **Consent:** `ad_storage` and `ad_user_data` required

**Behavior:** The tag should:
1. Read the event data via `getAllEventData()`
2. Build the Meta CAPI payload structure:
   ```json
   {
     "event_name": "Purchase",
     "event_time": 1711929600,
     "event_source_url": "https://iampatterson-com.vercel.app/demo/ecommerce/confirmation",
     "user_data": {
       "em": "[hashed]",
       "fn": "[hashed]",
       "ln": "[hashed]"
     },
     "custom_data": {
       "currency": "USD",
       "value": 49.98,
       "content_ids": ["tuna-plush"],
       "content_type": "product"
     },
     "action_source": "website"
   }
   ```
3. Log the payload to the sGTM console (via `logToConsole()`) with the prefix `[SIMULATED] Meta CAPI:`
4. **Do not make any HTTP request.** This is simulation only.

**Event name mapping for Meta:**

| sGTM Event | Meta Event Name |
|---|---|
| `purchase` | `Purchase` |
| `add_to_cart` | `AddToCart` |
| `begin_checkout` | `InitiateCheckout` |
| `trial_signup` | `StartTrial` |
| `form_complete` | `Lead` |

### Google Ads Enhanced Conversions — Simulated

- **Tag Name:** `Google Ads Enhanced Conversions - Simulated`
- **Firing Triggers:** `ce - purchase`, `ce - trial_signup` (high-value conversion events)
- **Consent:** `ad_storage` and `ad_user_data` required

**Behavior:** The tag should:
1. Read event data via `getAllEventData()`
2. Build the Enhanced Conversions payload:
   ```json
   {
     "conversion_action": "demo_purchase",
     "conversion_value": 49.98,
     "currency_code": "USD",
     "order_id": "ORD-ABC123",
     "user_data": {
       "sha256_email_address": "[hashed]",
       "sha256_first_name": "[hashed]",
       "sha256_last_name": "[hashed]"
     }
   }
   ```
3. Log to sGTM console with prefix `[SIMULATED] Google Ads EC:`
4. **Do not make any HTTP request.**

> **Why simulate?** There are no real Meta or Google Ads accounts connected to this demo. The simulation shows prospects exactly what payload would be sent to each platform, making the server-side delivery visible in the flip-the-card overlay. The Pub/Sub tag already captures the routing result (destination: `meta_capi` or `google_ads`, status: `simulated`) and streams it to the browser.

---

## Step 7 — Publish GTM Containers

After adding all variables, triggers, and tags:

1. **Web GTM (`GTM-MWHFMTZN`)**
   - Open the workspace in GTM
   - Review the container summary: should show 18 new items (18 variables, 7 triggers, 7 tags)
   - Click **Submit** → name the version "Phase 6 — Demo event tags"
   - **Publish**

2. **sGTM (`GTM-NTTKZFWD`)**
   - Open the workspace in sGTM on Stape
   - Review: should show 7 new triggers + 2 new tags
   - Click **Submit** → name the version "Phase 6 — Demo triggers + simulated ad tags"
   - **Publish**

> **Important:** Publish web GTM first. The web container pushes events to the data layer, which are then sent to sGTM. If sGTM publishes first with triggers for events that the web container isn't sending yet, nothing breaks — the triggers simply never fire until the web container catches up.

---

## Step 8 — Verify the Event Pipeline End-to-End

After both containers are published, test the full pipeline:

### 8a. Browser → GTM → sGTM

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

### 8b. sGTM → GA4

1. Open GA4 Realtime report (`G-9M2G3RLHWF`)
2. Confirm demo events appear: `product_view`, `add_to_cart`, `purchase`, etc.
3. Verify event parameters are populated (click into an event to see parameter values)

### 8c. sGTM → BigQuery

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

### 8d. sGTM → Pub/Sub → Flip-the-Card Overlay

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

### 8e. Subscription Demo

1. Navigate to `/demo/subscription`
2. Click "Start Free Trial" on any plan → verify `plan_select` fires
3. Submit the signup form → verify `trial_signup` fires
4. On the dashboard, click Upgrade/Downgrade/Cancel → verify `click_cta` fires

### 8f. Lead Gen Demo

1. Navigate to `/demo/leadgen`
2. Click into the first form field → verify `form_start` fires (once)
3. Tab through fields → verify `form_field_focus` fires per field
4. Submit the form → verify `form_complete` fires with `partnership_type`, `budget_range`, `company_name`
5. Immediately after, verify `lead_qualify` fires with `lead_id`, `qualification_tier`

---

## Step 9 — Update Container Spec Files

After the live GTM containers are configured and verified, update the spec files in the repo to reflect the current state:

1. **Update `infrastructure/gtm/web-container.json`:**
   - Add the 18 new data layer variables to the `variables` array
   - Add the 7 new triggers to the `triggers` array
   - Add the 7 new GA4 event tags to the `tags` array
   - Update `_meta.description` to reference Phase 6

2. **Update `infrastructure/gtm/server-container.json`:**
   - Add the 7 new triggers to the `triggers` array
   - Add the 2 simulated ad platform tags to the `tags` array
   - Remove the `phase6Additions` section (now integrated into the main spec)
   - Update `_meta.description` to reference Phase 6

3. **Regenerate import files** (if the team uses them):
   - `infrastructure/gtm/web-container-import.json`
   - `infrastructure/gtm/server-container-import.json`

4. **Commit:**
   ```bash
   git add infrastructure/gtm/
   git commit -m "feat(gtm): update container specs with Phase 6 demo event tags"
   ```

---

## Step 10 — Update Phase Status

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
