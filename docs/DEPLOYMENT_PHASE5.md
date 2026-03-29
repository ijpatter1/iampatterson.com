# Phase 5 — Data Infrastructure Deployment Guide

> **Scope:** Deploy the Dataform transformation pipeline (staging + marts), campaign taxonomy, data quality assertions, AI access layer, and RAG infrastructure.
>
> **Prerequisites:** Phase 4 backfill complete with the expanded schema (51 columns in `events_raw`, `ad_platform_raw` populated, `client_id` separate from `session_id`).

---

## Table of Contents

1. [Prerequisites](#1--prerequisites)
2. [Architecture Recap](#2--architecture-recap)
3. [Step 1 — Verify Raw Data](#3--step-1--verify-raw-data)
4. [Step 2 — Run Staging Models](#4--step-2--run-staging-models)
5. [Step 3 — Run Mart Models](#5--step-3--run-mart-models)
6. [Step 4 — Run Campaign Taxonomy](#6--step-4--run-campaign-taxonomy)
7. [Step 5 — Run Data Quality Assertions](#7--step-5--run-data-quality-assertions)
8. [Step 6 — Run Data Dictionary](#8--step-6--run-data-dictionary)
9. [Step 7 — Set Up AI Access Layer (Optional)](#9--step-7--set-up-ai-access-layer-optional)
10. [Step 8 — Set Up RAG Infrastructure (Optional)](#10--step-8--set-up-rag-infrastructure-optional)
11. [Step 9 — Connect Dataform to GitHub (Optional)](#11--step-9--connect-dataform-to-github-optional)
12. [Verification](#12--verification)
13. [Troubleshooting](#13--troubleshooting)

---

## 1 — Prerequisites

### Already Deployed (from prior phases)

| Resource | Status |
|---|---|
| Vertex AI API | Enabled |
| BigQuery connection (`vertex-ai-connection`) | Created |
| `AI.CLASSIFY` / `AI.IF` | Working |
| `iampatterson_raw.events_raw` | 49K+ events, 51 columns |
| `iampatterson_raw.ad_platform_raw` | 435+ records, 3 business models |
| `iampatterson_staging` dataset | Created (empty) |
| `iampatterson_marts` dataset | Created (empty) |
| Data generator (Cloud Run) | Deployed with client_id + BQ ad inserts |

### Tools Required

| Tool | Purpose |
|---|---|
| `bq` CLI | Run SQL statements against BigQuery |
| `gcloud` CLI | Manage GCP resources |
| `gsutil` | GCS bucket operations (AI access layer only) |

---

## 2 — Architecture Recap

```
iampatterson_raw              iampatterson_staging           iampatterson_marts
┌─────────────────┐          ┌─────────────────────┐        ┌──────────────────────────────┐
│ events_raw      │────────▶ │ stg_events          │───────▶│ mart_session_events          │
│ (51 cols)       │          │ (dedup, typed, UTM)  │        │ mart_campaign_performance    │
└─────────────────┘          └─────────────────────┘        │ mart_channel_attribution     │
                                       │                     │ mart_customer_ltv            │
                                       ▼                     │ mart_subscription_cohorts    │
                             ┌─────────────────────┐        │ mart_lead_funnel             │
                             │ stg_sessions         │───────▶│ campaign_taxonomy (AI)       │
                             │ (first-touch attrib) │        │ campaign_taxonomy_rules      │
                             └─────────────────────┘        │ campaign_taxonomy_validation  │
┌─────────────────┐          ┌─────────────────────┐        │ data_dictionary              │
│ ad_platform_raw │────────▶ │ stg_ad_platform     │───────▶└──────────────────────────────┘
└─────────────────┘          └─────────────────────┘
```

**Execution order matters.** Staging models must run before marts. The guide below is ordered correctly.

---

## 3 — Step 1 — Verify Raw Data

Before running the pipeline, confirm the raw data is present:

```bash
# Check events_raw has data with new columns
bq query --use_legacy_sql=false "
SELECT
  COUNT(*) as total_events,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNTIF(utm_source IS NOT NULL) as has_utm,
  COUNTIF(product_id IS NOT NULL) as has_product
FROM \`iampatterson.iampatterson_raw.events_raw\`"

# Check ad_platform_raw
bq query --use_legacy_sql=false "
SELECT COUNT(*) as total, COUNT(DISTINCT business_model) as models
FROM \`iampatterson.iampatterson_raw.ad_platform_raw\`"
```

**Expected:** 49K+ events, 9K+ unique clients, 435+ ad records across 3 models.

---

## 4 — Step 2 — Run Staging Models

Run these in order. Each creates a materialized table in `iampatterson_staging`.

### 2a. stg_events

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_staging.stg_events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY business_model, event_name, session_id
AS

WITH raw_events AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY event_name, session_id, received_timestamp
      ORDER BY received_timestamp
    ) AS _row_num
  FROM `iampatterson.iampatterson_raw.events_raw`
)

SELECT
  TO_HEX(SHA256(CONCAT(
    COALESCE(event_name, ''),
    COALESCE(session_id, ''),
    CAST(received_timestamp AS STRING),
    COALESCE(page_path, '')
  ))) AS event_id,
  event_name,
  COALESCE(
    SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*S%Ez', timestamp),
    SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', timestamp),
    TIMESTAMP_MILLIS(received_timestamp)
  ) AS event_timestamp,
  TIMESTAMP_MILLIS(received_timestamp) AS received_at,
  session_id,
  client_id,
  CASE
    WHEN page_path LIKE '/demo/ecommerce%' THEN 'ecommerce'
    WHEN page_path LIKE '/demo/subscription%' THEN 'subscription'
    WHEN page_path LIKE '/demo/leadgen%' THEN 'leadgen'
    ELSE 'consulting'
  END AS business_model,
  page_location,
  page_path,
  REPLACE(page_title, '+', ' ') AS page_title,
  page_referrer,
  REPLACE(utm_source, '+', ' ') AS utm_source,
  REPLACE(utm_medium, '+', ' ') AS utm_medium,
  REPLACE(utm_campaign, '+', ' ') AS utm_campaign,
  consent_analytics,
  consent_marketing,
  consent_preferences,
  CASE WHEN iap_source = 'true' THEN TRUE ELSE FALSE END AS is_synthetic,
  product_id,
  REPLACE(product_name, '+', ' ') AS product_name,
  product_price,
  REPLACE(product_category, '+', ' ') AS product_category,
  quantity,
  cart_total,
  item_count,
  order_id,
  order_total,
  REPLACE(products, '+', ' ') AS products,
  plan_id,
  REPLACE(plan_name, '+', ' ') AS plan_name,
  plan_price,
  renewal_month,
  revenue,
  tenure_months,
  reason AS churn_reason,
  form_name,
  field_name,
  form_success,
  partnership_type,
  budget_range,
  REPLACE(company_name, '+', ' ') AS company_name,
  lead_id,
  qualification_tier,
  depth_percentage,
  depth_pixels,
  link_text,
  link_url,
  cta_text,
  cta_location
FROM raw_events
WHERE _row_num = 1;
```

### 2b. stg_ad_platform

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_staging.stg_ad_platform`
PARTITION BY report_date
CLUSTER BY business_model, platform
AS
SELECT
  date AS report_date,
  platform,
  business_model,
  campaign_name,
  campaign_name_raw,
  impressions,
  clicks,
  spend AS spend_usd,
  SAFE_DIVIDE(spend, clicks) AS cpc_usd,
  SAFE_DIVIDE(clicks, impressions) AS ctr
FROM `iampatterson.iampatterson_raw.ad_platform_raw`
WHERE date IS NOT NULL AND platform IS NOT NULL;
```

### 2c. stg_sessions (depends on stg_events)

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_staging.stg_sessions`
PARTITION BY DATE(session_start)
CLUSTER BY business_model, utm_source
AS

WITH session_events AS (
  SELECT
    session_id, business_model, event_name, event_timestamp,
    utm_source, utm_medium, utm_campaign, is_synthetic,
    consent_analytics, consent_marketing,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY event_timestamp ASC) AS event_seq
  FROM `iampatterson.iampatterson_staging.stg_events`
  WHERE session_id IS NOT NULL
),
session_attribution AS (
  SELECT session_id, utm_source, utm_medium, utm_campaign,
    consent_analytics, consent_marketing, is_synthetic
  FROM session_events WHERE event_seq = 1
),
session_model AS (
  SELECT session_id, business_model,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY COUNT(*) DESC) AS model_rank
  FROM session_events GROUP BY session_id, business_model
)
SELECT
  s.session_id, sm.business_model,
  MIN(s.event_timestamp) AS session_start,
  MAX(s.event_timestamp) AS session_end,
  TIMESTAMP_DIFF(MAX(s.event_timestamp), MIN(s.event_timestamp), SECOND) AS session_duration_seconds,
  COUNT(*) AS event_count,
  COUNTIF(s.event_name = 'page_view') AS page_view_count,
  sa.utm_source, sa.utm_medium, sa.utm_campaign,
  sa.consent_analytics, sa.consent_marketing, sa.is_synthetic
FROM session_events s
JOIN session_attribution sa USING (session_id)
JOIN session_model sm ON s.session_id = sm.session_id AND sm.model_rank = 1
GROUP BY s.session_id, sm.business_model,
  sa.utm_source, sa.utm_medium, sa.utm_campaign,
  sa.consent_analytics, sa.consent_marketing, sa.is_synthetic;
```

**Verify staging:**

```bash
bq query --use_legacy_sql=false "
SELECT 'stg_events' as t, COUNT(*) as rows FROM \`iampatterson.iampatterson_staging.stg_events\`
UNION ALL SELECT 'stg_sessions', COUNT(*) FROM \`iampatterson.iampatterson_staging.stg_sessions\`
UNION ALL SELECT 'stg_ad_platform', COUNT(*) FROM \`iampatterson.iampatterson_staging.stg_ad_platform\`"
```

---

## 5 — Step 3 — Run Mart Models

These all depend on the staging tables. They can run in any order (no cross-mart dependencies).

### 3a. mart_session_events

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.mart_session_events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY business_model, event_name
AS
SELECT
  e.event_id, e.event_name, e.event_timestamp, e.business_model,
  e.session_id, e.page_path, e.page_title, e.is_synthetic,
  s.utm_source, s.utm_medium, s.utm_campaign,
  s.session_start, s.session_duration_seconds,
  s.event_count AS session_event_count,
  e.consent_analytics, e.consent_marketing,
  e.product_id, e.product_name, e.product_price, e.product_category,
  e.quantity, e.cart_total, e.item_count, e.order_id, e.order_total,
  e.plan_id, e.plan_name, e.plan_price, e.renewal_month, e.revenue,
  e.tenure_months, e.churn_reason,
  e.partnership_type, e.budget_range, e.company_name, e.lead_id, e.qualification_tier
FROM `iampatterson.iampatterson_staging.stg_events` e
LEFT JOIN `iampatterson.iampatterson_staging.stg_sessions` s USING (session_id);
```

### 3b. mart_campaign_performance

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.mart_campaign_performance`
PARTITION BY report_date
CLUSTER BY business_model, platform
AS
WITH daily_conversions AS (
  SELECT
    DATE(e.event_timestamp) AS event_date,
    s.utm_source AS platform,
    s.utm_campaign AS campaign_name_raw,
    e.business_model,
    COUNTIF(e.event_name = 'purchase') AS purchases,
    SUM(IF(e.event_name = 'purchase', e.order_total, 0)) AS purchase_revenue,
    COUNTIF(e.event_name = 'add_to_cart') AS add_to_carts,
    COUNTIF(e.event_name = 'product_view') AS product_views,
    COUNTIF(e.event_name = 'trial_signup') AS trial_signups,
    COUNTIF(e.event_name = 'subscription_renewal') AS renewals,
    SUM(IF(e.event_name = 'subscription_renewal', e.revenue, 0)) AS subscription_revenue,
    COUNTIF(e.event_name = 'form_complete') AS form_completions,
    COUNTIF(e.event_name = 'lead_qualify') AS qualified_leads,
    COUNT(DISTINCT e.session_id) AS sessions
  FROM `iampatterson.iampatterson_staging.stg_events` e
  JOIN `iampatterson.iampatterson_staging.stg_sessions` s USING (session_id)
  WHERE s.utm_campaign IS NOT NULL
  GROUP BY 1, 2, 3, 4
),
ad_spend AS (
  SELECT report_date, platform, business_model, campaign_name,
    campaign_name_raw, impressions, clicks, spend_usd
  FROM `iampatterson.iampatterson_staging.stg_ad_platform`
)
SELECT
  COALESCE(a.report_date, c.event_date) AS report_date,
  COALESCE(a.platform, c.platform) AS platform,
  COALESCE(a.business_model, c.business_model) AS business_model,
  a.campaign_name,
  COALESCE(a.campaign_name_raw, c.campaign_name_raw) AS campaign_name_raw,
  COALESCE(a.impressions, 0) AS impressions,
  COALESCE(a.clicks, 0) AS clicks,
  COALESCE(a.spend_usd, 0) AS spend_usd,
  COALESCE(c.sessions, 0) AS sessions,
  COALESCE(c.product_views, 0) AS product_views,
  COALESCE(c.add_to_carts, 0) AS add_to_carts,
  COALESCE(c.purchases, 0) AS purchases,
  COALESCE(c.purchase_revenue, 0) AS purchase_revenue,
  COALESCE(c.trial_signups, 0) AS trial_signups,
  COALESCE(c.renewals, 0) AS renewals,
  COALESCE(c.subscription_revenue, 0) AS subscription_revenue,
  COALESCE(c.form_completions, 0) AS form_completions,
  COALESCE(c.qualified_leads, 0) AS qualified_leads,
  SAFE_DIVIDE(COALESCE(a.spend_usd, 0), COALESCE(c.sessions, 0)) AS cost_per_session,
  SAFE_DIVIDE(COALESCE(a.spend_usd, 0), COALESCE(c.purchases, 0)) AS cost_per_purchase,
  SAFE_DIVIDE(COALESCE(c.purchase_revenue, 0), COALESCE(a.spend_usd, 0)) AS roas
FROM ad_spend a
FULL OUTER JOIN daily_conversions c
  ON a.report_date = c.event_date AND a.platform = c.platform
  AND a.campaign_name_raw = c.campaign_name_raw AND a.business_model = c.business_model;
```

### 3c. mart_channel_attribution

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.mart_channel_attribution`
PARTITION BY report_month
CLUSTER BY business_model, utm_source
AS
WITH session_conversions AS (
  SELECT
    s.session_id, s.business_model, s.utm_source, s.utm_medium,
    DATE_TRUNC(s.session_start, MONTH) AS report_month,
    MAX(IF(e.event_name = 'purchase', 1, 0)) AS has_purchase,
    MAX(IF(e.event_name = 'add_to_cart', 1, 0)) AS has_add_to_cart,
    SUM(IF(e.event_name = 'purchase', e.order_total, 0)) AS session_revenue,
    MAX(IF(e.event_name = 'trial_signup', 1, 0)) AS has_trial_signup,
    MAX(IF(e.event_name = 'form_complete', 1, 0)) AS has_form_complete,
    MAX(IF(e.event_name = 'lead_qualify', 1, 0)) AS has_qualified_lead
  FROM `iampatterson.iampatterson_staging.stg_sessions` s
  JOIN `iampatterson.iampatterson_staging.stg_events` e USING (session_id)
  WHERE s.utm_source IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5
)
SELECT
  report_month, business_model, utm_source, utm_medium,
  COUNT(*) AS sessions,
  SUM(has_purchase) AS converting_sessions,
  SUM(session_revenue) AS attributed_revenue,
  SAFE_DIVIDE(SUM(has_purchase), COUNT(*)) AS conversion_rate,
  SAFE_DIVIDE(SUM(session_revenue), COUNT(*)) AS revenue_per_session,
  SUM(has_trial_signup) AS trial_signups,
  SAFE_DIVIDE(SUM(has_trial_signup), COUNT(*)) AS trial_signup_rate,
  SUM(has_form_complete) AS form_completions,
  SUM(has_qualified_lead) AS qualified_leads,
  SAFE_DIVIDE(SUM(has_form_complete), COUNT(*)) AS form_completion_rate,
  SAFE_DIVIDE(SUM(has_qualified_lead), COUNT(*)) AS lead_qualification_rate
FROM session_conversions GROUP BY 1, 2, 3, 4;
```

### 3d. mart_customer_ltv

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.mart_customer_ltv`
CLUSTER BY utm_source
AS
WITH customer_purchases AS (
  SELECT e.client_id, e.session_id, s.utm_source, s.utm_medium, s.utm_campaign,
    e.event_timestamp, e.order_id, e.order_total, e.item_count
  FROM `iampatterson.iampatterson_staging.stg_events` e
  JOIN `iampatterson.iampatterson_staging.stg_sessions` s USING (session_id)
  WHERE e.event_name = 'purchase' AND e.business_model = 'ecommerce'
    AND e.order_total > 0 AND e.client_id IS NOT NULL
),
first_touch AS (
  SELECT client_id, utm_source, utm_medium, utm_campaign,
    ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY event_timestamp ASC) AS rn
  FROM customer_purchases
),
customer_summary AS (
  SELECT client_id,
    COUNT(DISTINCT order_id) AS total_orders,
    COUNT(DISTINCT session_id) AS purchase_sessions,
    MIN(event_timestamp) AS first_purchase_at,
    MAX(event_timestamp) AS last_purchase_at,
    SUM(order_total) AS total_revenue,
    AVG(order_total) AS avg_order_value,
    SUM(item_count) AS total_items
  FROM customer_purchases GROUP BY client_id
)
SELECT
  cs.client_id, ft.utm_source, ft.utm_medium, ft.utm_campaign,
  cs.first_purchase_at, cs.last_purchase_at,
  TIMESTAMP_DIFF(cs.last_purchase_at, cs.first_purchase_at, DAY) AS customer_tenure_days,
  cs.total_orders, cs.purchase_sessions, cs.total_revenue,
  cs.avg_order_value, cs.total_items,
  SAFE_DIVIDE(cs.total_revenue, GREATEST(TIMESTAMP_DIFF(cs.last_purchase_at, cs.first_purchase_at, DAY), 1)) * 365 AS annualized_revenue,
  DATE_TRUNC(DATE(cs.first_purchase_at), MONTH) AS acquisition_month
FROM customer_summary cs
JOIN first_touch ft ON cs.client_id = ft.client_id AND ft.rn = 1;
```

### 3e. mart_subscription_cohorts

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.mart_subscription_cohorts`
PARTITION BY cohort_month
CLUSTER BY plan_name, utm_source
AS
WITH signups AS (
  SELECT e.session_id, e.event_timestamp AS signup_at, e.plan_id, e.plan_name,
    e.plan_price, s.utm_source, s.utm_medium, s.utm_campaign,
    DATE_TRUNC(DATE(e.event_timestamp), MONTH) AS cohort_month
  FROM `iampatterson.iampatterson_staging.stg_events` e
  JOIN `iampatterson.iampatterson_staging.stg_sessions` s USING (session_id)
  WHERE e.event_name = 'trial_signup' AND e.business_model = 'subscription'
),
renewals AS (
  SELECT session_id, renewal_month, revenue, plan_name AS renewal_plan_name
  FROM `iampatterson.iampatterson_staging.stg_events`
  WHERE event_name = 'subscription_renewal' AND business_model = 'subscription'
),
churns AS (
  SELECT session_id, tenure_months, churn_reason, event_timestamp AS churn_at
  FROM `iampatterson.iampatterson_staging.stg_events`
  WHERE event_name = 'subscription_churn' AND business_model = 'subscription'
),
signup_outcomes AS (
  SELECT su.session_id, su.signup_at, su.plan_id, su.plan_name, su.plan_price,
    su.utm_source, su.utm_medium, su.utm_campaign, su.cohort_month,
    COUNT(DISTINCT r.renewal_month) AS total_renewals,
    COALESCE(SUM(r.revenue), 0) AS total_renewal_revenue,
    MAX(r.renewal_month) AS last_renewal_month,
    MIN(c.churn_at) AS churn_at,
    MIN(c.tenure_months) AS tenure_at_churn,
    MIN(c.churn_reason) AS churn_reason,
    IF(MIN(c.churn_at) IS NOT NULL, TRUE, FALSE) AS has_churned
  FROM signups su
  LEFT JOIN renewals r ON su.session_id = r.session_id
  LEFT JOIN churns c ON su.session_id = c.session_id
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
)
SELECT cohort_month, plan_id, plan_name, plan_price, utm_source, utm_medium, session_id,
  signup_at, total_renewals, total_renewal_revenue,
  plan_price + total_renewal_revenue AS lifetime_revenue,
  last_renewal_month, has_churned, churn_at, tenure_at_churn, churn_reason,
  TIMESTAMP_DIFF(COALESCE(churn_at, CURRENT_TIMESTAMP()), signup_at, DAY) AS days_active
FROM signup_outcomes;
```

### 3f. mart_lead_funnel

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.mart_lead_funnel`
PARTITION BY DATE(session_start)
CLUSTER BY utm_source, qualification_tier
AS
WITH lead_sessions AS (
  SELECT
    s.session_id, s.session_start, s.utm_source, s.utm_medium, s.utm_campaign,
    DATE_TRUNC(DATE(s.session_start), MONTH) AS report_month,
    MAX(IF(e.event_name = 'page_view', 1, 0)) AS has_page_view,
    MAX(IF(e.event_name = 'form_start', 1, 0)) AS has_form_start,
    MAX(IF(e.event_name = 'form_complete', 1, 0)) AS has_form_complete,
    MAX(IF(e.event_name = 'lead_qualify', 1, 0)) AS has_lead_qualify,
    MAX(IF(e.event_name = 'form_complete', e.partnership_type, NULL)) AS partnership_type,
    MAX(IF(e.event_name = 'form_complete', e.budget_range, NULL)) AS budget_range,
    MAX(IF(e.event_name = 'form_complete', e.company_name, NULL)) AS company_name,
    MAX(IF(e.event_name = 'lead_qualify', e.lead_id, NULL)) AS lead_id,
    MAX(IF(e.event_name = 'lead_qualify', e.qualification_tier, NULL)) AS qualification_tier,
    COUNT(DISTINCT IF(e.event_name = 'form_field_focus', e.field_name, NULL)) AS fields_interacted,
    COUNTIF(e.event_name = 'scroll_depth') AS scroll_events
  FROM `iampatterson.iampatterson_staging.stg_sessions` s
  JOIN `iampatterson.iampatterson_staging.stg_events` e USING (session_id)
  WHERE s.business_model = 'leadgen'
  GROUP BY 1, 2, 3, 4, 5, 6
)
SELECT session_id, session_start, report_month, utm_source, utm_medium, utm_campaign,
  has_page_view, has_form_start, has_form_complete, has_lead_qualify,
  CASE
    WHEN has_lead_qualify = 1 THEN 'qualified'
    WHEN has_form_complete = 1 THEN 'submitted'
    WHEN has_form_start = 1 THEN 'started'
    WHEN has_page_view = 1 THEN 'visited'
    ELSE 'unknown'
  END AS funnel_stage,
  partnership_type, budget_range, company_name, lead_id, qualification_tier,
  fields_interacted, scroll_events
FROM lead_sessions;
```

**Verify marts:**

```bash
bq query --use_legacy_sql=false "
SELECT 'mart_session_events' as t, COUNT(*) as rows FROM \`iampatterson.iampatterson_marts.mart_session_events\`
UNION ALL SELECT 'mart_campaign_performance', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_campaign_performance\`
UNION ALL SELECT 'mart_channel_attribution', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_channel_attribution\`
UNION ALL SELECT 'mart_customer_ltv', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_customer_ltv\`
UNION ALL SELECT 'mart_subscription_cohorts', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_subscription_cohorts\`
UNION ALL SELECT 'mart_lead_funnel', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_lead_funnel\`"
```

---

## 6 — Step 4 — Run Campaign Taxonomy

### 4a. Rule-based taxonomy (no Vertex AI needed)

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.campaign_taxonomy_rules`
CLUSTER BY business_model, campaign_type
AS
WITH distinct_campaigns AS (
  SELECT DISTINCT utm_campaign AS campaign_name_raw, utm_source AS platform, utm_medium
  FROM `iampatterson.iampatterson_staging.stg_events`
  WHERE utm_campaign IS NOT NULL
)
SELECT
  campaign_name_raw, platform, utm_medium,
  CASE
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'brand|merch') THEN 'brand'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'shopping|shop|pla') THEN 'shopping'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'retarget|rtg|cart.?abandon|remarketing') THEN 'retargeting'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'lookalike|lal|similar') THEN 'lookalike'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'interest|prospect|prosp|cat.?lover|pet.?owner') THEN 'prospecting'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'broad|content') THEN 'content'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'newsletter|email|wkly|weekly|monthly') THEN 'newsletter'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'trial|subscription|sub_') THEN 'subscription_acquisition'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'partner|lead|b2b|enterprise') THEN 'lead_generation'
    ELSE 'unclassified'
  END AS campaign_type,
  CASE
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'tuna|merch|shop|cart|product|plush|mug|pin') THEN 'ecommerce'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'trial|subscription|plan|box|renewal') THEN 'subscription'
    WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'partner|lead|b2b|enterprise|brand.?collab') THEN 'leadgen'
    ELSE 'general'
  END AS business_model,
  LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'brand|merch|tuna') AS is_brand_campaign,
  CONCAT(UPPER(platform), ' - ',
    UPPER(CASE
      WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'brand|merch') THEN 'brand'
      WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'shopping|shop|pla') THEN 'shopping'
      WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'retarget|rtg|cart.?abandon') THEN 'retargeting'
      WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'lookalike|lal|similar') THEN 'lookalike'
      WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'interest|prospect|prosp|cat.?lover|pet.?owner') THEN 'prospecting'
      WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'broad|content') THEN 'content'
      WHEN LOWER(REPLACE(campaign_name_raw, '+', ' ')) REGEXP_CONTAINS(r'newsletter|email') THEN 'newsletter'
      ELSE 'other'
    END)
  ) AS campaign_name_standardized
FROM distinct_campaigns;
```

### 4b. AI-powered taxonomy (requires Vertex AI)

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.campaign_taxonomy`
CLUSTER BY business_model, campaign_type
AS
WITH distinct_campaigns AS (
  SELECT DISTINCT utm_campaign AS campaign_name_raw, utm_source, utm_medium
  FROM `iampatterson.iampatterson_staging.stg_events`
  WHERE utm_campaign IS NOT NULL
),
classified AS (
  SELECT campaign_name_raw, utm_source, utm_medium,
    AI.CLASSIFY(
      CONCAT('Classify this advertising campaign name into a campaign type: "', campaign_name_raw, '"'),
      ['brand', 'prospecting', 'retargeting', 'shopping', 'content', 'lookalike', 'newsletter', 'interest_targeting']
    ) AS campaign_type,
    AI.CLASSIFY(
      CONCAT('Classify which business this campaign serves based on the name: "', campaign_name_raw, '"'),
      ['ecommerce', 'subscription', 'leadgen', 'general']
    ) AS business_model,
    AI.IF(
      CONCAT('Does this campaign name "', campaign_name_raw, '" contain a brand term like "tuna", "merch", or "brand"?')
    ) AS is_brand_campaign
  FROM distinct_campaigns
)
SELECT campaign_name_raw, utm_source AS platform, utm_medium,
  campaign_type, business_model, is_brand_campaign,
  CONCAT(UPPER(utm_source), ' - ', UPPER(campaign_type), ' - ', UPPER(business_model)) AS campaign_name_standardized
FROM classified;
```

### 4c. Taxonomy validation (depends on campaign_taxonomy)

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.campaign_taxonomy_validation`
CLUSTER BY platform, campaign_type
AS
WITH campaign_volumes AS (
  SELECT utm_campaign AS campaign_name_raw, utm_source AS platform,
    COUNT(*) AS total_events, COUNT(DISTINCT session_id) AS unique_sessions,
    COUNTIF(event_name = 'purchase') AS purchases,
    SUM(IF(event_name = 'purchase', order_total, 0)) AS revenue,
    COUNTIF(event_name = 'trial_signup') AS trial_signups,
    COUNTIF(event_name = 'form_complete') AS form_completions
  FROM `iampatterson.iampatterson_staging.stg_events`
  WHERE utm_campaign IS NOT NULL GROUP BY 1, 2
)
SELECT t.campaign_name_raw, t.platform, t.campaign_type, t.business_model,
  t.is_brand_campaign, t.campaign_name_standardized,
  v.total_events, v.unique_sessions, v.purchases, v.revenue,
  v.trial_signups, v.form_completions,
  COUNT(*) OVER (PARTITION BY t.campaign_name_standardized) AS variant_count_in_group
FROM `iampatterson.iampatterson_marts.campaign_taxonomy` t
LEFT JOIN campaign_volumes v ON t.campaign_name_raw = v.campaign_name_raw AND t.platform = v.platform
ORDER BY t.campaign_name_standardized, v.total_events DESC;
```

---

## 7 — Step 5 — Run Data Quality Assertions

These queries should return **zero rows** if the data is healthy. Any rows returned indicate a data quality issue.

```sql
-- 1. stg_events: no null event_names, valid timestamps, valid business models
SELECT event_id, event_name, event_timestamp, business_model
FROM `iampatterson.iampatterson_staging.stg_events`
WHERE event_name IS NULL OR event_timestamp IS NULL
  OR business_model NOT IN ('ecommerce', 'subscription', 'leadgen', 'consulting');

-- 2. stg_sessions: valid session boundaries
SELECT session_id, session_start, session_end, session_duration_seconds
FROM `iampatterson.iampatterson_staging.stg_sessions`
WHERE session_id IS NULL OR session_start IS NULL
  OR session_start > session_end OR session_duration_seconds < 0;

-- 3. Purchase events have positive revenue
SELECT event_id, order_id, order_total
FROM `iampatterson.iampatterson_staging.stg_events`
WHERE event_name = 'purchase' AND (order_total IS NULL OR order_total <= 0);

-- 4. Subscription events have plan fields
SELECT event_id, event_name, plan_id, plan_name
FROM `iampatterson.iampatterson_staging.stg_events`
WHERE event_name IN ('trial_signup', 'plan_select', 'subscription_renewal', 'subscription_churn')
  AND (plan_id IS NULL OR plan_name IS NULL);
```

---

## 8 — Step 6 — Run Data Dictionary

Run this **after** all staging and mart tables are created (it reads INFORMATION_SCHEMA):

```sql
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.data_dictionary`
CLUSTER BY dataset_name, table_name
AS
WITH staging_columns AS (
  SELECT 'iampatterson_staging' AS dataset_name, table_name, column_name,
    ordinal_position, data_type, is_nullable,
    CASE table_name
      WHEN 'stg_events' THEN 'Deduplicated, typed events from raw event stream'
      WHEN 'stg_sessions' THEN 'Session-level aggregation with first-touch attribution'
      WHEN 'stg_ad_platform' THEN 'Validated ad platform spend data'
      ELSE table_name
    END AS table_description
  FROM `iampatterson.iampatterson_staging.INFORMATION_SCHEMA.COLUMNS`
),
mart_columns AS (
  SELECT 'iampatterson_marts' AS dataset_name, table_name, column_name,
    ordinal_position, data_type, is_nullable,
    CASE table_name
      WHEN 'mart_session_events' THEN 'Session-enriched event stream for cross-model analysis'
      WHEN 'mart_campaign_performance' THEN 'Campaign spend vs conversion performance with ROAS'
      WHEN 'mart_channel_attribution' THEN 'Channel-level attribution by business model and month'
      WHEN 'mart_customer_ltv' THEN 'E-commerce customer lifetime value by acquisition channel'
      WHEN 'mart_subscription_cohorts' THEN 'Subscription cohort lifecycle tracking'
      WHEN 'mart_lead_funnel' THEN 'Lead gen funnel progression with qualification stages'
      WHEN 'campaign_taxonomy' THEN 'AI-classified campaign name standardization'
      WHEN 'campaign_taxonomy_rules' THEN 'Rule-based campaign classification'
      WHEN 'campaign_taxonomy_validation' THEN 'Campaign taxonomy audit with event volume context'
      WHEN 'data_dictionary' THEN 'Auto-generated schema documentation'
      ELSE table_name
    END AS table_description
  FROM `iampatterson.iampatterson_marts.INFORMATION_SCHEMA.COLUMNS`
),
all_columns AS (
  SELECT * FROM staging_columns UNION ALL SELECT * FROM mart_columns
)
SELECT dataset_name, table_name, table_description, column_name,
  ordinal_position, data_type, is_nullable,
  CONCAT('Column: ', column_name, ' (', data_type, ')') AS column_description
FROM all_columns
ORDER BY dataset_name, table_name, ordinal_position;
```

---

## 9 — Step 7 — Set Up AI Access Layer (Optional)

Creates a GCS bucket for parquet exports and a read-only service account.

```bash
cd infrastructure/bigquery/ai_access_layer

# Create bucket, service account, and permissions
./setup.sh

# Export mart tables to GCS as parquet
./export.sh
```

**What this does:**
- Creates `gs://iampatterson-ai-exports` with 30-day lifecycle
- Creates `ai-access-reader@iampatterson.iam.gserviceaccount.com` with read-only access to mart datasets
- Exports all mart tables as Snappy-compressed parquet files

---

## 10 — Step 8 — Set Up RAG Infrastructure (Optional)

Requires mart tables to be populated first.

```bash
# Create embedding models, generate embeddings, create vector indexes
bq query --use_legacy_sql=false --multiline < infrastructure/bigquery/rag/setup_rag.sql

# Create stored procedures for semantic querying
bq query --use_legacy_sql=false --multiline < infrastructure/bigquery/rag/semantic_query.sql
```

**Note:** The `setup_rag.sql` file contains multiple statements. You may need to run them one at a time in the BigQuery console if `bq` doesn't support multi-statement execution. The statements are clearly separated with comments.

**Test it:**

```sql
CALL iampatterson_marts.semantic_search('Which channels drive the highest ROAS?', 10);
```

---

## 11 — Step 9 — Connect Dataform to GitHub

GCP Dataform requires `dataform.json` at the repo root — it doesn't support subdirectories. To handle this, we maintain a dedicated `dataform` branch where the Dataform files are mirrored at the root level.

### Branch Architecture

```
main (and phase branches)          dataform branch
├── infrastructure/                ├── dataform.json        (from infrastructure/dataform/)
│   └── dataform/                  ├── package.json         (Dataform's, not Next.js)
│       ├── dataform.json          ├── definitions/         (mirrored)
│       ├── package.json           ├── includes/            (mirrored)
│       ├── definitions/           ├── src/                 (ignored by Dataform)
│       └── includes/              └── ...                  (rest of repo, ignored)
├── src/
└── ...
```

A GitHub Action (`.github/workflows/sync-dataform.yml`) automatically syncs `infrastructure/dataform/` → root of the `dataform` branch whenever changes are pushed to `main`.

### Setup Steps

**1. Prerequisites** (already done):
- Dataform API enabled
- GitHub PAT stored in Secret Manager as `dataform-github-token`
- Dataform service account granted `secretmanager.secretAccessor`

**2. Push the `dataform` branch to GitHub:**

```bash
git push origin dataform
```

**3. Configure the Dataform repository** (in the GCP Console):
- Go to BigQuery > Dataform > `iampatterson-dataform`
- Set Git remote: `https://github.com/ijpatter1/iampatterson.com.git`
- Set default branch: `dataform`
- Set secret: `dataform-github-token`

**4. Create a Development Workspace:**
- In the Dataform repo, click "Create Development Workspace"
- Name it (e.g., `dev`)
- Click into the workspace — you should see the `definitions/` folder with all models

**5. Test compilation:**
- In the workspace, click "Compile" or check the compilation status
- All models should compile without errors
- You can run individual models or "Start Execution" for all

**6. Create a Release Configuration** (for production):
- Go to Releases & Scheduling > Create Release Configuration
- Name: `production`
- Git branch: `dataform`
- Frequency: daily or on-demand

**7. Create a Workflow Configuration** (scheduled execution):
- Go to Releases & Scheduling > Create Workflow Configuration
- Name: `daily-pipeline`
- Release configuration: `production`
- Schedule: daily (e.g., 04:00 UTC — after the data generator's 02:00-03:00 UTC jobs)
- Select all actions (or specific tags if you want to run subsets)

### Keeping the Branch in Sync

The `sync-dataform` GitHub Action handles this automatically:
- Triggers on push to `main` when `infrastructure/dataform/**` files change
- Copies Dataform files to root of the `dataform` branch
- Commits and pushes if there are changes

For manual sync (if the Action hasn't run yet or you're on a phase branch):

```bash
git checkout dataform
git checkout main -- infrastructure/dataform/
cp infrastructure/dataform/dataform.json ./dataform.json
cp infrastructure/dataform/package.json ./package.json
rm -rf definitions/ includes/
cp -r infrastructure/dataform/definitions ./definitions
cp -r infrastructure/dataform/includes ./includes
git add dataform.json package.json definitions/ includes/
git commit -m "chore(dataform): manual sync from main"
git push origin dataform
```

---

## 12 — Verification

After running all steps, verify the full pipeline:

```bash
bq query --use_legacy_sql=false "
SELECT dataset, table_name, row_count FROM (
  SELECT 'staging' as dataset, 'stg_events' as table_name, COUNT(*) as row_count FROM \`iampatterson.iampatterson_staging.stg_events\`
  UNION ALL SELECT 'staging', 'stg_sessions', COUNT(*) FROM \`iampatterson.iampatterson_staging.stg_sessions\`
  UNION ALL SELECT 'staging', 'stg_ad_platform', COUNT(*) FROM \`iampatterson.iampatterson_staging.stg_ad_platform\`
  UNION ALL SELECT 'marts', 'mart_session_events', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_session_events\`
  UNION ALL SELECT 'marts', 'mart_campaign_performance', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_campaign_performance\`
  UNION ALL SELECT 'marts', 'mart_channel_attribution', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_channel_attribution\`
  UNION ALL SELECT 'marts', 'mart_customer_ltv', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_customer_ltv\`
  UNION ALL SELECT 'marts', 'mart_subscription_cohorts', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_subscription_cohorts\`
  UNION ALL SELECT 'marts', 'mart_lead_funnel', COUNT(*) FROM \`iampatterson.iampatterson_marts.mart_lead_funnel\`
  UNION ALL SELECT 'marts', 'campaign_taxonomy', COUNT(*) FROM \`iampatterson.iampatterson_marts.campaign_taxonomy\`
  UNION ALL SELECT 'marts', 'campaign_taxonomy_rules', COUNT(*) FROM \`iampatterson.iampatterson_marts.campaign_taxonomy_rules\`
)
ORDER BY dataset, table_name"
```

All tables should have rows. Zero-row tables indicate a problem in the dependency chain.

---

## 13 — Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `stg_events` has 0 rows | `events_raw` is empty | Run backfill first (see `docs/DEPLOYMENT_PHASE4.md`) |
| `stg_sessions` has 0 rows | `stg_events` not created yet | Run stg_events first |
| `mart_campaign_performance` has 0 spend | `ad_platform_raw` is empty | Rebuild and redeploy data generator with BQ insert code |
| `campaign_taxonomy` fails | Vertex AI API not enabled | `gcloud services enable aiplatform.googleapis.com` |
| `AI.CLASSIFY` returns error | Connection not set up | See Step 4b prerequisites |
| RAG procedures fail | Mart tables empty | Run Steps 2-3 first |
| `data_dictionary` missing columns | Run too early | Run after all other tables are created |
