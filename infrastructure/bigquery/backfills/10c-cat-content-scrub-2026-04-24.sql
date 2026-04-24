-- Phase 10c D2: cat-content scrub
-- Author: 2026-04-24
-- Companion doc: 10c-cat-content-scrub-2026-04-24.md
--
-- Background: Phase 10c D1 (commit bccdb74) replaced three LLM-hallucinated
-- cat-themed campaigns in the data generator with dog-themed equivalents.
-- This script backfills the rows already landed in BigQuery using the same
-- deterministic remap so existing data matches the corrected source.
--
-- Idempotent: re-running after a clean apply is a no-op (every WHERE clause
-- targets only the legacy strings; UPDATE drops back to zero affected rows).
--
-- Apply order: events_raw (utm_campaign) → ad_platform_raw (campaign_name)
-- → ad_platform_raw (campaign_name_raw). The three statements are
-- independent; running them in parallel via separate `bq query` invocations
-- is also safe.
--
-- Encoding note:
--   * events_raw.utm_campaign stores form-urlencoded values (sGTM forwards
--     /g/collect parameters without decoding). Spaces become '+'.
--   * ad_platform_raw.campaign_name + .campaign_name_raw store raw strings
--     (the data generator inserts directly via @google-cloud/bigquery, no
--     URL encoding in the path).
--
-- Re-classification of downstream Dataform models is automatic on the next
-- workflow run (stg_events, stg_ad_platform, mart_*, campaign_taxonomy*).
-- The campaign_taxonomy_rules.sqlx regex was updated in this same change
-- to drop the now-dead `cat.?lover` token; AI campaign_taxonomy reclassifies
-- on next run from the new labels.

-- ============================================================================
-- Step 1 — events_raw.utm_campaign (form-urlencoded)
-- ============================================================================
UPDATE `iampatterson.iampatterson_raw.events_raw`
SET utm_campaign = CASE utm_campaign
    WHEN 'google_prosp_catlovers'                THEN 'google_prosp_smalldogs'
    WHEN 'Google+Prospecting+Cat+Lovers'         THEN 'Google+Prospecting+Small+Dog+Owners'
    WHEN 'g_prospect_cat-lovers'                 THEN 'g_prospect_small-dogs'
    WHEN 'meta_broad_catcontent'                 THEN 'meta_broad_dogcontent'
    WHEN 'FB+Broad+Cat+Content'                  THEN 'FB+Broad+Dog+Content'
    WHEN 'META_BROAD_CAT'                        THEN 'META_BROAD_DOG'
    WHEN 'meta-broad-cat-content'                THEN 'meta-broad-dog-content'
    WHEN 'google_search_catsub'                  THEN 'google_search_dogsub'
    WHEN 'Google+Search+-+Cat+Subscription+Box'  THEN 'Google+Search+-+Dog+Subscription+Box'
    WHEN 'g_srch_cat_sub_box'                    THEN 'g_srch_dog_sub_box'
    ELSE utm_campaign
  END
WHERE utm_campaign IN (
    'google_prosp_catlovers',
    'Google+Prospecting+Cat+Lovers',
    'g_prospect_cat-lovers',
    'meta_broad_catcontent',
    'FB+Broad+Cat+Content',
    'META_BROAD_CAT',
    'meta-broad-cat-content',
    'google_search_catsub',
    'Google+Search+-+Cat+Subscription+Box',
    'g_srch_cat_sub_box'
  );

-- ============================================================================
-- Step 2 — ad_platform_raw.campaign_name (canonical name, raw — not encoded)
-- ============================================================================
UPDATE `iampatterson.iampatterson_raw.ad_platform_raw`
SET campaign_name = CASE campaign_name
    WHEN 'Google - Prospecting - Cat Lovers'      THEN 'Google - Prospecting - Small Dog Owners'
    WHEN 'Meta - Broad - Cat Content'             THEN 'Meta - Broad - Dog Content'
    WHEN 'Google - Search - Cat Subscription Box' THEN 'Google - Search - Dog Subscription Box'
    ELSE campaign_name
  END
WHERE campaign_name IN (
    'Google - Prospecting - Cat Lovers',
    'Meta - Broad - Cat Content',
    'Google - Search - Cat Subscription Box'
  );

-- ============================================================================
-- Step 3 — ad_platform_raw.campaign_name_raw (UTM variant, raw — not encoded)
-- ============================================================================
UPDATE `iampatterson.iampatterson_raw.ad_platform_raw`
SET campaign_name_raw = CASE campaign_name_raw
    WHEN 'google_prosp_catlovers'                 THEN 'google_prosp_smalldogs'
    WHEN 'Google Prospecting Cat Lovers'          THEN 'Google Prospecting Small Dog Owners'
    WHEN 'g_prospect_cat-lovers'                  THEN 'g_prospect_small-dogs'
    WHEN 'meta_broad_catcontent'                  THEN 'meta_broad_dogcontent'
    WHEN 'FB Broad Cat Content'                   THEN 'FB Broad Dog Content'
    WHEN 'META_BROAD_CAT'                         THEN 'META_BROAD_DOG'
    WHEN 'meta-broad-cat-content'                 THEN 'meta-broad-dog-content'
    WHEN 'google_search_catsub'                   THEN 'google_search_dogsub'
    WHEN 'Google Search - Cat Subscription Box'   THEN 'Google Search - Dog Subscription Box'
    WHEN 'g_srch_cat_sub_box'                     THEN 'g_srch_dog_sub_box'
    ELSE campaign_name_raw
  END
WHERE campaign_name_raw IN (
    'google_prosp_catlovers',
    'Google Prospecting Cat Lovers',
    'g_prospect_cat-lovers',
    'meta_broad_catcontent',
    'FB Broad Cat Content',
    'META_BROAD_CAT',
    'meta-broad-cat-content',
    'google_search_catsub',
    'Google Search - Cat Subscription Box',
    'g_srch_cat_sub_box'
  );

-- ============================================================================
-- Step 4 (Pass-1 evaluator supplement) — events_raw.company_name
-- ============================================================================
-- Tech-evaluator Important #3: brand-vocabulary pin missed COMPANY_NAMES in
-- engines/leadgen.ts. Three off-brand names ('Feline First',
-- 'Catitude Brands', 'Purrfect Partners') had already shipped to events_raw
-- via form_complete events. Code fix in same Pass-1 batch swaps them for
-- 'Hound House' / 'Pawsitive Brands' / 'Pawfect Partners' and exports
-- COMPANY_NAMES so the pin walks it.
--
-- Form-urlencoded (sGTM forwards /g/collect params without decoding; spaces → '+').
UPDATE `iampatterson.iampatterson_raw.events_raw`
SET company_name = CASE company_name
    WHEN 'Feline+First'      THEN 'Hound+House'
    WHEN 'Catitude+Brands'   THEN 'Pawsitive+Brands'
    WHEN 'Purrfect+Partners' THEN 'Pawfect+Partners'
    ELSE company_name
  END
WHERE company_name IN (
    'Feline+First',
    'Catitude+Brands',
    'Purrfect+Partners'
  );
