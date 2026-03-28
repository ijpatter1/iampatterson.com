-- ============================================================================
-- Semantic Query Stored Procedures for RAG
--
-- These procedures accept natural language questions and return
-- AI-generated answers grounded in the mart data via vector search.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Generic semantic search procedure
-- Usage: CALL iampatterson_marts.semantic_search('which channels drive the most revenue?', 10);
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE `iampatterson.iampatterson_marts.semantic_search`(
  question STRING,
  top_k INT64
)
BEGIN
  -- Step 1: Generate embedding for the question
  CREATE TEMP TABLE question_embedding AS
  SELECT *
  FROM ML.GENERATE_TEXT_EMBEDDING(
    MODEL `iampatterson.iampatterson_marts.embedding_model`,
    (SELECT question AS content),
    STRUCT(TRUE AS flatten_json_output)
  );

  -- Step 2: Search across all embedding tables
  CREATE TEMP TABLE search_results AS

  -- Campaign performance results
  SELECT content, 'campaign_performance' AS source
  FROM VECTOR_SEARCH(
    TABLE `iampatterson.iampatterson_marts.rag_campaign_embeddings`,
    'text_embedding',
    TABLE question_embedding,
    'text_embedding',
    top_k => top_k
  )

  UNION ALL

  -- Channel attribution results
  SELECT content, 'channel_attribution' AS source
  FROM VECTOR_SEARCH(
    TABLE `iampatterson.iampatterson_marts.rag_channel_embeddings`,
    'text_embedding',
    TABLE question_embedding,
    'text_embedding',
    top_k => top_k
  )

  UNION ALL

  -- Subscription cohort results
  SELECT content, 'subscription_cohorts' AS source
  FROM VECTOR_SEARCH(
    TABLE `iampatterson.iampatterson_marts.rag_subscription_embeddings`,
    'text_embedding',
    TABLE question_embedding,
    'text_embedding',
    top_k => top_k
  );

  -- Step 3: Generate answer using retrieved context
  SELECT ml_generate_text_result AS answer
  FROM ML.GENERATE_TEXT(
    MODEL `iampatterson.iampatterson_marts.gemini_model`,
    (
      SELECT CONCAT(
        'You are a marketing analytics assistant for iampatterson.com. ',
        'Answer the following question using ONLY the data provided below. ',
        'Be specific with numbers and dates. If the data doesn''t contain enough ',
        'information to answer, say so.\n\n',
        'Question: ', question, '\n\n',
        'Data:\n',
        STRING_AGG(CONCAT('- [', source, '] ', content), '\n')
      ) AS prompt
      FROM search_results
    ),
    STRUCT(
      0.2 AS temperature,
      1024 AS max_output_tokens
    )
  );

  DROP TABLE question_embedding;
  DROP TABLE search_results;
END;

-- ---------------------------------------------------------------------------
-- Business model specific query
-- Usage: CALL iampatterson_marts.query_business('ecommerce', 'what is my best performing campaign?');
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE `iampatterson.iampatterson_marts.query_business`(
  business STRING,
  question STRING
)
BEGIN
  -- Gather context from all relevant marts for the business model
  CREATE TEMP TABLE business_context AS

  -- Campaign performance (all business models)
  SELECT CONCAT(
    '[Campaign] ', COALESCE(campaign_name_raw, '?'),
    ' on ', COALESCE(platform, '?'),
    '. Spend: $', CAST(ROUND(spend_usd, 2) AS STRING),
    ', Revenue: $', CAST(ROUND(purchase_revenue, 2) AS STRING),
    ', ROAS: ', CAST(ROUND(COALESCE(roas, 0), 2) AS STRING),
    ', Sessions: ', CAST(sessions AS STRING)
  ) AS summary
  FROM `iampatterson.iampatterson_marts.mart_campaign_performance`
  WHERE business_model = business
    AND report_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  ORDER BY spend_usd DESC
  LIMIT 30

  UNION ALL

  -- Subscription cohorts (subscription business model)
  SELECT CONCAT(
    '[Subscription] Plan: ', COALESCE(plan_name, '?'),
    ', Cohort: ', CAST(cohort_month AS STRING),
    ', Channel: ', COALESCE(utm_source, '?'),
    ', Renewals: ', CAST(total_renewals AS STRING),
    ', LTV: $', CAST(ROUND(lifetime_revenue, 2) AS STRING),
    ', Churned: ', IF(has_churned, 'Yes', 'No'),
    IF(has_churned, CONCAT(' (month ', CAST(COALESCE(tenure_at_churn, 0) AS STRING), ')'), '')
  ) AS summary
  FROM `iampatterson.iampatterson_marts.mart_subscription_cohorts`
  WHERE business = 'subscription'
  ORDER BY cohort_month DESC
  LIMIT 30

  UNION ALL

  -- Lead funnel (leadgen business model)
  SELECT CONCAT(
    '[Lead] Stage: ', funnel_stage,
    ', Channel: ', COALESCE(utm_source, '?'),
    ', Partnership: ', COALESCE(partnership_type, '?'),
    ', Budget: ', COALESCE(budget_range, '?'),
    ', Tier: ', COALESCE(qualification_tier, 'n/a')
  ) AS summary
  FROM `iampatterson.iampatterson_marts.mart_lead_funnel`
  WHERE business = 'leadgen'
    AND session_start >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
  ORDER BY session_start DESC
  LIMIT 30;

  -- Generate answer
  SELECT ml_generate_text_result AS answer
  FROM ML.GENERATE_TEXT(
    MODEL `iampatterson.iampatterson_marts.gemini_model`,
    (
      SELECT CONCAT(
        'You are a marketing analytics assistant for the ', business,
        ' business model. Answer using ONLY the data below. Be specific with numbers.\n\n',
        STRING_AGG(summary, '\n'),
        '\n\nQuestion: ', question
      ) AS prompt
      FROM business_context
    ),
    STRUCT(
      0.2 AS temperature,
      1024 AS max_output_tokens
    )
  );

  DROP TABLE business_context;
END;
