# Data Dictionary

> Auto-generated reference for all Dataform models in the iampatterson pipeline.
> A live version of this dictionary also exists as `iampatterson_marts.data_dictionary` in BigQuery.

## Datasets

| Dataset | Purpose |
|---|---|
| `iampatterson_raw` | Untouched event data from sGTM and ad platform imports |
| `iampatterson_staging` | Flattened, deduped, typed events with standardized columns |
| `iampatterson_marts` | Business-ready tables for BI, dashboards, and analysis |
| `iampatterson_assertions` | Data quality assertion results |

---

## Raw Layer

### `iampatterson_raw.events_raw`
Ingestion-time partitioned (daily), clustered by `event_name`, `session_id`.
Raw event data written by sGTM "All Event Data" BigQuery tag. 51 columns covering core event fields, UTM attribution, e-commerce, subscription, and lead gen parameters.

### `iampatterson_raw.ad_platform_raw`
Partitioned by `date`, clustered by `platform`, `business_model`.
Simulated ad platform spend data — one row per campaign per day per business model.

---

## Staging Layer

### `stg_events`
**Partitioned by:** `DATE(event_timestamp)` | **Clustered by:** `business_model`, `event_name`, `session_id`

Deduplicated events with typed timestamps, business model classification, URL-decoded string values, and synthetic event flagging.

| Column | Type | Description |
|---|---|---|
| `event_id` | STRING | SHA256 hash of event_name + the resolved session key + received_timestamp + page_path |
| `event_name` | STRING | Snake_case event name (page_view, product_view, purchase, etc.) |
| `event_timestamp` | TIMESTAMP | Parsed from client ISO 8601 string, falls back to server received_timestamp |
| `received_at` | TIMESTAMP | Server-side sGTM processing timestamp |
| `iap_session_id` | STRING | The unremapped session key as sent by the site. Present on every instrumented event; the source `session_id` resolves from. |
| `session_id` | STRING | Resolved session key: `COALESCE(iap_session_id, session_id)`. The raw `session_id` is reserved in gtag.js, which consumes it before the hit is built, so it is NULL on every real-browser row; `iap_session_id` is the field GA4 will not rewrite and is what the sGTM Pub/Sub tag keys on. Resolving here is what puts real visitors in the warehouse at all. |
| `client_id` | STRING | GA4 client ID |
| `business_model` | STRING | Derived from page_path: ecommerce, subscription, leadgen, consulting |
| `utm_source` | STRING | Traffic source |
| `utm_medium` | STRING | Traffic medium |
| `utm_campaign` | STRING | Raw campaign name (URL-decoded) |
| `is_synthetic` | BOOL | True only for background data generator traffic. Derived from the generator's own `iap_synthetic` marker, falling back to its user agent for rows written before that marker shipped. NOT from `iap_source`, which the real site sends too — that mislabelled every real visitor as synthetic. |
| `product_id` | STRING | Product SKU (product_view, add_to_cart) |
| `product_name` | STRING | Product display name (URL-decoded) |
| `product_price` | FLOAT64 | Product unit price USD |
| `order_id` | STRING | Order identifier (purchase) |
| `order_total` | FLOAT64 | Order total USD (purchase) |
| `products` | STRING | JSON array of products (purchase) |
| `plan_id` | STRING | Subscription plan ID |
| `plan_name` | STRING | Subscription plan name (URL-decoded) |
| `plan_price` | FLOAT64 | Monthly plan price USD |
| `renewal_month` | INT64 | Renewal month number (subscription_renewal) |
| `revenue` | FLOAT64 | Renewal revenue USD (subscription_renewal) |
| `tenure_months` | INT64 | Months before churn (subscription_churn) |
| `churn_reason` | STRING | Churn reason (subscription_churn) |
| `partnership_type` | STRING | Partnership type (form_complete, lead_qualify) |
| `budget_range` | STRING | Budget range (form_complete, lead_qualify) |
| `qualification_tier` | STRING | Lead quality: high, medium, low (lead_qualify) |

### `stg_sessions`
**Partitioned by:** `DATE(session_start)` | **Clustered by:** `business_model`, `utm_source`

One row per session with first-touch attribution, duration, and event counts.

| Column | Type | Description |
|---|---|---|
| `session_id` | STRING | UUID session identifier |
| `business_model` | STRING | Most-frequent business model in session |
| `session_start` | TIMESTAMP | First event timestamp |
| `session_end` | TIMESTAMP | Last event timestamp |
| `session_duration_seconds` | INT64 | Duration between first and last event |
| `event_count` | INT64 | Total events in session |
| `utm_source` | STRING | First-touch traffic source |
| `utm_medium` | STRING | First-touch traffic medium |
| `utm_campaign` | STRING | First-touch campaign name |

### `stg_ad_platform`
**Partitioned by:** `report_date` | **Clustered by:** `business_model`, `platform`

Validated ad platform spend data with derived CPC and CTR.

---

## Mart Layer

### `mart_session_events`
Session-enriched event stream. Joins event data with session-level attribution for cross-model analysis.

### `mart_campaign_performance`
Campaign spend vs conversion performance. Joins ad platform spend with session/conversion data. Includes ROAS, cost per purchase, cost per session.

### `mart_channel_attribution`
Monthly channel-level attribution. Sessions, conversions, and revenue by utm_source/utm_medium per business model.

### `mart_customer_ltv`
E-commerce customer lifetime value. Purchase history per session with total spend, order count, annualized revenue by acquisition channel.

### `mart_subscription_cohorts`
Subscription cohort lifecycle. Trial signups through renewals and churn by monthly cohort, plan, and acquisition channel.

### `mart_lead_funnel`
Lead gen funnel progression. Tracks sessions through visited → started → submitted → qualified stages with attribution and engagement metrics.

---

## Taxonomy Layer

### `campaign_taxonomy` (AI-powered)
Uses BigQuery `AI.CLASSIFY` to standardize messy campaign names into clean types. Requires Vertex AI API and BigQuery connection.

### `campaign_taxonomy_rules` (rule-based)
Deterministic regex-based campaign classification. Works without AI functions. Serves as fallback and validation baseline.

### `campaign_taxonomy_validation`
Audit table joining taxonomy classifications with event volumes for quality review.

---

## Data Quality Assertions

| Assertion | Validates |
|---|---|
| `assert_stg_events` | No null event_names, valid timestamps, valid business models |
| `assert_stg_sessions` | session_start present and ≤ session_end, non-negative duration, and at least one non-synthetic session in the last 30 days. The null-session check was removed: `stg_sessions` filters those rows itself, so asserting their absence could never fail. |
| `assert_purchase_revenue` | Purchase events have positive order_total |
| `assert_subscription_events` | Subscription events have plan_id and plan_name |
| `assert_volume_anomaly` | No more than 10% of the last 30 days' weekdays have zero events (weekends are idle by design) |
