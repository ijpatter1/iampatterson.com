/**
 * Tests for Dataform model SQL files.
 *
 * These tests validate:
 * - All expected model files exist
 * - SQL files contain required references and patterns
 * - Constants module exports expected values
 * - Schema JSON files are valid
 */
import * as fs from 'fs';
import * as path from 'path';

const DATAFORM_ROOT = path.join(process.cwd(), 'infrastructure/dataform');
const BQ_ROOT = path.join(process.cwd(), 'infrastructure/bigquery');

// ---------------------------------------------------------------------------
// Helper: read a .sqlx file
// ---------------------------------------------------------------------------
function readSqlx(relativePath: string): string {
  return fs.readFileSync(path.join(DATAFORM_ROOT, relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// Dataform project structure
// ---------------------------------------------------------------------------
describe('Dataform project structure', () => {
  test('dataform.json exists and is valid', () => {
    const raw = fs.readFileSync(path.join(DATAFORM_ROOT, 'dataform.json'), 'utf-8');
    const config = JSON.parse(raw);
    expect(config.warehouse).toBe('bigquery');
    expect(config.defaultDatabase).toBe('iampatterson');
    expect(config.defaultSchema).toBe('iampatterson_staging');
    expect(config.assertionSchema).toBe('iampatterson_assertions');
  });

  test('package.json has @dataform/core dependency', () => {
    const raw = fs.readFileSync(path.join(DATAFORM_ROOT, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    expect(pkg.dependencies['@dataform/core']).toBeDefined();
  });

  test('includes/constants.js exports required values', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const constants = require(path.join(DATAFORM_ROOT, 'includes/constants.js'));
    expect(constants.PROJECT).toBe('iampatterson');
    expect(constants.RAW_DATASET).toBe('iampatterson_raw');
    expect(constants.STAGING_DATASET).toBe('iampatterson_staging');
    expect(constants.MARTS_DATASET).toBe('iampatterson_marts');
    expect(constants.ECOMMERCE_EVENTS).toContain('purchase');
    expect(constants.SUBSCRIPTION_EVENTS).toContain('trial_signup');
    expect(constants.LEADGEN_EVENTS).toContain('lead_qualify');
  });
});

// ---------------------------------------------------------------------------
// Staging models
// ---------------------------------------------------------------------------
describe('Staging models', () => {
  const stagingModels = [
    'definitions/staging/stg_events.sqlx',
    'definitions/staging/stg_sessions.sqlx',
    'definitions/staging/stg_ad_platform.sqlx',
  ];

  test.each(stagingModels)('%s exists', (modelPath) => {
    expect(fs.existsSync(path.join(DATAFORM_ROOT, modelPath))).toBe(true);
  });

  test('stg_events references raw events_raw table', () => {
    const sql = readSqlx('definitions/staging/stg_events.sqlx');
    expect(sql).toContain('events_raw');
    expect(sql).toContain('iampatterson_raw');
  });

  test('stg_events converts timestamps', () => {
    const sql = readSqlx('definitions/staging/stg_events.sqlx');
    expect(sql).toContain('TIMESTAMP_MILLIS');
    expect(sql).toContain('PARSE_TIMESTAMP');
    expect(sql).toContain('event_timestamp');
  });

  test('stg_events derives business_model from page_path', () => {
    const sql = readSqlx('definitions/staging/stg_events.sqlx');
    expect(sql).toContain('/demo/ecommerce');
    expect(sql).toContain('/demo/subscription');
    expect(sql).toContain('/demo/leadgen');
    expect(sql).toContain('business_model');
  });

  test('stg_events deduplicates with ROW_NUMBER', () => {
    const sql = readSqlx('definitions/staging/stg_events.sqlx');
    expect(sql).toContain('ROW_NUMBER()');
    expect(sql).toContain('_row_num = 1');
  });

  test('stg_events includes all demo parameter columns', () => {
    const sql = readSqlx('definitions/staging/stg_events.sqlx');
    // E-commerce
    expect(sql).toContain('product_id');
    expect(sql).toContain('product_name');
    expect(sql).toContain('product_price');
    expect(sql).toContain('order_id');
    expect(sql).toContain('order_total');
    // Subscription
    expect(sql).toContain('plan_id');
    expect(sql).toContain('plan_name');
    expect(sql).toContain('renewal_month');
    expect(sql).toContain('tenure_months');
    // Lead gen
    expect(sql).toContain('partnership_type');
    expect(sql).toContain('qualification_tier');
    expect(sql).toContain('lead_id');
  });

  test('stg_events includes UTM fields', () => {
    const sql = readSqlx('definitions/staging/stg_events.sqlx');
    expect(sql).toContain('utm_source');
    expect(sql).toContain('utm_medium');
    expect(sql).toContain('utm_campaign');
  });

  test('stg_sessions references stg_events', () => {
    const sql = readSqlx('definitions/staging/stg_sessions.sqlx');
    expect(sql).toContain('ref("stg_events")');
  });

  test('stg_sessions computes first-touch attribution', () => {
    const sql = readSqlx('definitions/staging/stg_sessions.sqlx');
    expect(sql).toContain('utm_source');
    expect(sql).toContain('utm_medium');
    expect(sql).toContain('utm_campaign');
    expect(sql).toContain('event_seq = 1');
  });

  test('stg_ad_platform references ad_platform_raw', () => {
    const sql = readSqlx('definitions/staging/stg_ad_platform.sqlx');
    expect(sql).toContain('ad_platform_raw');
    expect(sql).toContain('SAFE_DIVIDE');
  });
});

// ---------------------------------------------------------------------------
// Mart models
// ---------------------------------------------------------------------------
describe('Mart models', () => {
  const martModels = [
    'definitions/marts/mart_session_events.sqlx',
    'definitions/marts/mart_campaign_performance.sqlx',
    'definitions/marts/mart_channel_attribution.sqlx',
    'definitions/marts/mart_customer_ltv.sqlx',
    'definitions/marts/mart_subscription_cohorts.sqlx',
    'definitions/marts/mart_lead_funnel.sqlx',
  ];

  test.each(martModels)('%s exists', (modelPath) => {
    expect(fs.existsSync(path.join(DATAFORM_ROOT, modelPath))).toBe(true);
  });

  test('mart_campaign_performance joins ad spend with conversions', () => {
    const sql = readSqlx('definitions/marts/mart_campaign_performance.sqlx');
    expect(sql).toContain('ref("stg_ad_platform")');
    expect(sql).toContain('ref("stg_events")');
    expect(sql).toContain('spend_usd');
    expect(sql).toContain('purchase_revenue');
    expect(sql).toContain('roas');
  });

  test('mart_channel_attribution aggregates by channel', () => {
    const sql = readSqlx('definitions/marts/mart_channel_attribution.sqlx');
    expect(sql).toContain('ref("stg_sessions")');
    expect(sql).toContain('conversion_rate');
    expect(sql).toContain('utm_source');
  });

  test('mart_customer_ltv calculates lifetime value', () => {
    const sql = readSqlx('definitions/marts/mart_customer_ltv.sqlx');
    expect(sql).toContain('total_revenue');
    expect(sql).toContain('total_orders');
    expect(sql).toContain('annualized_revenue');
    expect(sql).toContain('ecommerce');
  });

  test('mart_subscription_cohorts tracks cohort lifecycle', () => {
    const sql = readSqlx('definitions/marts/mart_subscription_cohorts.sqlx');
    expect(sql).toContain('cohort_month');
    expect(sql).toContain('trial_signup');
    expect(sql).toContain('has_churned');
    expect(sql).toContain('lifetime_revenue');
    expect(sql).toContain('tenure_at_churn');
  });

  test('mart_lead_funnel tracks funnel stages', () => {
    const sql = readSqlx('definitions/marts/mart_lead_funnel.sqlx');
    expect(sql).toContain('funnel_stage');
    expect(sql).toContain('form_start');
    expect(sql).toContain('form_complete');
    expect(sql).toContain('lead_qualify');
    expect(sql).toContain('qualification_tier');
  });

  test('all mart models target iampatterson_marts schema', () => {
    for (const modelPath of martModels) {
      const sql = readSqlx(modelPath);
      expect(sql).toContain('schema: "iampatterson_marts"');
    }
  });
});

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
describe('Dataform assertions', () => {
  const assertions = [
    'definitions/assertions/assert_stg_events.sqlx',
    'definitions/assertions/assert_stg_sessions.sqlx',
    'definitions/assertions/assert_purchase_revenue.sqlx',
    'definitions/assertions/assert_subscription_events.sqlx',
    'definitions/assertions/assert_volume_anomaly.sqlx',
  ];

  test.each(assertions)('%s exists', (assertionPath) => {
    expect(fs.existsSync(path.join(DATAFORM_ROOT, assertionPath))).toBe(true);
  });

  test('all assertions have type: "assertion" config', () => {
    for (const assertionPath of assertions) {
      const sql = readSqlx(assertionPath);
      expect(sql).toContain('type: "assertion"');
    }
  });
});

// ---------------------------------------------------------------------------
// BigQuery schema files
// ---------------------------------------------------------------------------
describe('BigQuery schema files', () => {
  test('events_raw schema is valid JSON with all demo columns', () => {
    const raw = fs.readFileSync(path.join(BQ_ROOT, 'schema.json'), 'utf-8');
    const schema = JSON.parse(raw);
    const columnNames = schema.map((col: { name: string }) => col.name);

    // Core columns
    expect(columnNames).toContain('event_name');
    expect(columnNames).toContain('received_timestamp');
    expect(columnNames).toContain('session_id');

    // UTM columns (new)
    expect(columnNames).toContain('utm_source');
    expect(columnNames).toContain('utm_medium');
    expect(columnNames).toContain('utm_campaign');

    // E-commerce columns (new)
    expect(columnNames).toContain('product_id');
    expect(columnNames).toContain('product_price');
    expect(columnNames).toContain('order_id');
    expect(columnNames).toContain('order_total');

    // Subscription columns (new)
    expect(columnNames).toContain('plan_id');
    expect(columnNames).toContain('plan_price');
    expect(columnNames).toContain('tenure_months');

    // Lead gen columns (new)
    expect(columnNames).toContain('lead_id');
    expect(columnNames).toContain('qualification_tier');
    expect(columnNames).toContain('partnership_type');
  });

  test('ad_platform_raw schema is valid JSON', () => {
    const raw = fs.readFileSync(path.join(BQ_ROOT, 'ad_platform_schema.json'), 'utf-8');
    const schema = JSON.parse(raw);
    const columnNames = schema.map((col: { name: string }) => col.name);

    expect(columnNames).toContain('date');
    expect(columnNames).toContain('platform');
    expect(columnNames).toContain('business_model');
    expect(columnNames).toContain('campaign_name');
    expect(columnNames).toContain('campaign_name_raw');
    expect(columnNames).toContain('impressions');
    expect(columnNames).toContain('clicks');
    expect(columnNames).toContain('spend');
  });

  test('events_raw schema has correct types for numeric fields', () => {
    const raw = fs.readFileSync(path.join(BQ_ROOT, 'schema.json'), 'utf-8');
    const schema = JSON.parse(raw);
    const byName = new Map(
      schema.map((col: { name: string; type: string }) => [col.name, col.type]),
    );

    expect(byName.get('product_price')).toBe('FLOAT64');
    expect(byName.get('order_total')).toBe('FLOAT64');
    expect(byName.get('plan_price')).toBe('FLOAT64');
    expect(byName.get('revenue')).toBe('FLOAT64');
    expect(byName.get('quantity')).toBe('INT64');
    expect(byName.get('item_count')).toBe('INT64');
    expect(byName.get('renewal_month')).toBe('INT64');
    expect(byName.get('tenure_months')).toBe('INT64');
  });
});
