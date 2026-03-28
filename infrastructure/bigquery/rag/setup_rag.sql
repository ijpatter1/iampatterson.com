-- ============================================================================
-- RAG Infrastructure Setup for iampatterson.com
--
-- Prerequisites:
--   1. Vertex AI API enabled
--   2. BigQuery connection 'vertex-ai-connection' created (same as taxonomy)
--   3. Connection SA has Vertex AI User role
--
-- Run these statements in order in the BigQuery console or via bq query.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create the embedding model reference
-- ---------------------------------------------------------------------------
CREATE OR REPLACE MODEL `iampatterson.iampatterson_marts.embedding_model`
REMOTE WITH CONNECTION `iampatterson.us.vertex-ai-connection`
OPTIONS (
  endpoint = 'text-embedding-005'
);

-- ---------------------------------------------------------------------------
-- 2. Create the text generation model reference (for RAG responses)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE MODEL `iampatterson.iampatterson_marts.gemini_model`
REMOTE WITH CONNECTION `iampatterson.us.vertex-ai-connection`
OPTIONS (
  endpoint = 'gemini-2.0-flash'
);

-- ---------------------------------------------------------------------------
-- 3. Generate embeddings on mart table summaries
--    This creates a denormalized text representation of each mart row
--    suitable for semantic search.
-- ---------------------------------------------------------------------------

-- Campaign performance embeddings
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.rag_campaign_embeddings` AS
SELECT *
FROM ML.GENERATE_TEXT_EMBEDDING(
  MODEL `iampatterson.iampatterson_marts.embedding_model`,
  (
    SELECT
      CONCAT(report_date) AS title,
      CONCAT(
        'Campaign: ', COALESCE(campaign_name_raw, 'unknown'),
        ' on ', COALESCE(platform, 'unknown'),
        ' (', COALESCE(business_model, 'unknown'), ')',
        '. Date: ', CAST(report_date AS STRING),
        '. Spend: $', CAST(ROUND(spend_usd, 2) AS STRING),
        ', Sessions: ', CAST(sessions AS STRING),
        ', Purchases: ', CAST(purchases AS STRING),
        ', Revenue: $', CAST(ROUND(purchase_revenue, 2) AS STRING),
        ', ROAS: ', CAST(ROUND(COALESCE(roas, 0), 2) AS STRING),
        ', Trial Signups: ', CAST(trial_signups AS STRING),
        ', Form Completions: ', CAST(form_completions AS STRING)
      ) AS content
    FROM `iampatterson.iampatterson_marts.mart_campaign_performance`
    WHERE report_date IS NOT NULL
  ),
  STRUCT(TRUE AS flatten_json_output)
);

-- Channel attribution embeddings
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.rag_channel_embeddings` AS
SELECT *
FROM ML.GENERATE_TEXT_EMBEDDING(
  MODEL `iampatterson.iampatterson_marts.embedding_model`,
  (
    SELECT
      CONCAT(CAST(report_month AS STRING), '-', utm_source) AS title,
      CONCAT(
        'Channel: ', COALESCE(utm_source, 'unknown'),
        '/', COALESCE(utm_medium, 'unknown'),
        ' (', COALESCE(business_model, 'unknown'), ')',
        '. Month: ', CAST(report_month AS STRING),
        '. Sessions: ', CAST(sessions AS STRING),
        ', Conversion Rate: ', CAST(ROUND(COALESCE(conversion_rate, 0) * 100, 1) AS STRING), '%',
        ', Revenue: $', CAST(ROUND(COALESCE(attributed_revenue, 0), 2) AS STRING),
        ', Trial Signups: ', CAST(COALESCE(trial_signups, 0) AS STRING),
        ', Qualified Leads: ', CAST(COALESCE(qualified_leads, 0) AS STRING)
      ) AS content
    FROM `iampatterson.iampatterson_marts.mart_channel_attribution`
  ),
  STRUCT(TRUE AS flatten_json_output)
);

-- Subscription cohort embeddings
CREATE OR REPLACE TABLE `iampatterson.iampatterson_marts.rag_subscription_embeddings` AS
SELECT *
FROM ML.GENERATE_TEXT_EMBEDDING(
  MODEL `iampatterson.iampatterson_marts.embedding_model`,
  (
    SELECT
      CONCAT(CAST(cohort_month AS STRING), '-', plan_name, '-', session_id) AS title,
      CONCAT(
        'Subscription: ', COALESCE(plan_name, 'unknown'),
        ' ($', CAST(ROUND(COALESCE(plan_price, 0), 2) AS STRING), '/mo)',
        '. Cohort: ', CAST(cohort_month AS STRING),
        '. Channel: ', COALESCE(utm_source, 'unknown'),
        '. Renewals: ', CAST(total_renewals AS STRING),
        ', Lifetime Revenue: $', CAST(ROUND(lifetime_revenue, 2) AS STRING),
        ', Churned: ', IF(has_churned, CONCAT('Yes (month ', CAST(COALESCE(tenure_at_churn, 0) AS STRING), ', reason: ', COALESCE(churn_reason, 'unknown'), ')'), 'No'),
        ', Days Active: ', CAST(days_active AS STRING)
      ) AS content
    FROM `iampatterson.iampatterson_marts.mart_subscription_cohorts`
  ),
  STRUCT(TRUE AS flatten_json_output)
);

-- ---------------------------------------------------------------------------
-- 4. Create vector search indexes for fast similarity search
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VECTOR INDEX `campaign_embedding_idx`
ON `iampatterson.iampatterson_marts.rag_campaign_embeddings`(text_embedding)
OPTIONS (
  index_type = 'IVF',
  distance_type = 'COSINE'
);

CREATE OR REPLACE VECTOR INDEX `channel_embedding_idx`
ON `iampatterson.iampatterson_marts.rag_channel_embeddings`(text_embedding)
OPTIONS (
  index_type = 'IVF',
  distance_type = 'COSINE'
);

CREATE OR REPLACE VECTOR INDEX `subscription_embedding_idx`
ON `iampatterson.iampatterson_marts.rag_subscription_embeddings`(text_embedding)
OPTIONS (
  index_type = 'IVF',
  distance_type = 'COSINE'
);
