/**
 * Tests for Dataform model SQL files.
 *
 * These tests validate:
 * - The definitions directory holds exactly the thinned model set (18.1)
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

  // Until 2026-09-12 this asserted only that `@dataform/core` was *defined*,
  // which every version satisfies. #66 (core 2→3) therefore sat green for four
  // days on a check that could not fail, while nothing ever compiled the
  // project. The `dataform` job in .github/workflows/test.yml compiles it now.
  //
  // That job derives the CLI version from this exact string
  // (`npx @dataform/cli@<core version>`), because the CLI and core ship in
  // lockstep and a separately pinned CLI is a second thing to keep in sync.
  // A range would be substituted literally and resolve to something npx cannot
  // fetch, so the exact form is load-bearing for the gate, not cosmetic.
  test('@dataform/core is pinned exactly, because the CI gate derives the CLI version from it', () => {
    const raw = fs.readFileSync(path.join(DATAFORM_ROOT, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    const core = pkg.dependencies?.['@dataform/core'];
    expect(core).toBeDefined();
    expect(core).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // package.json here is a PRODUCTION artifact: .github/workflows/sync-dataform.yml
  // copies it to the root of the `dataform` branch, which is what GCP Dataform
  // compiles from. A devDependency added for CI would ship a 193-package tree
  // into the production project and pull two high advisories into a
  // Dependabot-watched directory, so the CLI is deliberately absent.
  test('no CI-only dependencies leak into the manifest GCP compiles from', () => {
    const raw = fs.readFileSync(path.join(DATAFORM_ROOT, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    expect(pkg.devDependencies).toBeUndefined();
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@dataform/core']);
  });

  test('includes/url_decode.js decodes with correct nesting order', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { url_decode } = require(path.join(DATAFORM_ROOT, 'includes/url_decode.js'));
    const result = url_decode('my_column');

    // All expected encodings present (uppercase)
    expect(result).toContain("'+'");
    expect(result).toContain("'%20'");
    expect(result).toContain("'%26'");
    expect(result).toContain("'%3D'");
    expect(result).toContain("'%2B'");
    expect(result).toContain("'%25'");
    expect(result).toContain("'%2F'");
    expect(result).toContain("'%3A'");
    expect(result).toContain("'%3F'");
    expect(result).toContain("'%23'");
    expect(result).toContain("'%40'");
    expect(result).toContain('my_column');

    // Lowercase variants
    expect(result).toContain("'%3d'");
    expect(result).toContain("'%2f'");
    expect(result).toContain("'%3a'");
    expect(result).toContain("'%3f'");
    expect(result).toContain("'%2b'");

    // Critical: %25 must be innermost (decoded first) to prevent double-decoding.
    // In nested REPLACE(REPLACE(...REPLACE(col, '%25', '%')..., '+', ' ')),
    // the innermost pattern (%25) appears closest to the column name (just after it).
    const pct25Pos = result.indexOf("'%25'");
    const columnPos = result.indexOf('my_column');
    const pct20Pos = result.indexOf("'%20'");
    // %25 is innermost: appears right after column, before %20
    expect(pct25Pos).toBeGreaterThan(columnPos);
    expect(pct25Pos).toBeLessThan(pct20Pos);

    // + must be the absolute outermost REPLACE (decoded last).
    // The outermost REPLACE starts at the beginning of the string.
    expect(result).toMatch(/^REPLACE\(.+, '\+', ' '\)$/s);
  });

  test('includes/url_decode.js handles double-encoded values correctly', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { url_decode } = require(path.join(DATAFORM_ROOT, 'includes/url_decode.js'));

    // Simulate the REPLACE chain execution order for %252B (double-encoded +)
    // Step 1 (innermost): %25 → % transforms %252B → %2B
    // Step N: %2B → + transforms %2B → +
    // Step last: + → space transforms + → space
    // Net result: %252B → space (correct for double-encoded + in URL)

    // Verify by tracing through: the generated SQL applies REPLACEs from
    // innermost to outermost. We can verify the order by checking that
    // %25 appears closer to the column than %2B in the nesting.
    const result = url_decode('val');
    const pct25Pos = result.indexOf("'%25'");
    const pct2BPos = result.indexOf("'%2B'");
    const plusPos = result.lastIndexOf("'+'");

    // %25 decoded before %2B (innermost = lower string position)
    expect(pct25Pos).toBeLessThan(pct2BPos);
    // %2B decoded before + (inner = lower string position)
    expect(pct2BPos).toBeLessThan(plusPos);
  });

  test('includes/constants.js exports required values', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const constants = require(path.join(DATAFORM_ROOT, 'includes/constants.js'));
    expect(constants.PROJECT).toBe('iampatterson');
    expect(constants.RAW_DATASET).toBe('iampatterson_raw');
    expect(constants.STAGING_DATASET).toBe('iampatterson_staging');
    expect(constants.MARTS_DATASET).toBe('iampatterson_marts');
  });

  // The per-demo event lists and route prefixes scoped the ecommerce,
  // subscription and lead-generation marts, which 18.1 removed. Nothing else
  // read them, so leaving them would describe a warehouse that no longer exists.
  test("includes/constants.js no longer carries the removed demo marts' event lists", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const constants = require(path.join(DATAFORM_ROOT, 'includes/constants.js'));
    for (const name of [
      'ECOMMERCE_EVENTS',
      'SUBSCRIPTION_EVENTS',
      'LEADGEN_EVENTS',
      'ECOMMERCE_PREFIX',
      'SUBSCRIPTION_PREFIX',
      'LEADGEN_PREFIX',
    ]) {
      expect(constants).not.toHaveProperty(name);
    }
  });
});

// ---------------------------------------------------------------------------
// The model set (18.1)
// ---------------------------------------------------------------------------
// Every file under definitions/ runs every night at 04:00 UTC, and every one
// the demo needed and real traffic does not is a nightly cost and a nightly
// chance to page. 18.1 thinned the set to the three models real traffic needs,
// their assertions and the one raw declaration. Pinning the exact list makes
// adding a model back a deliberate edit here and in
// scripts/dataform-graph-check.mjs, not a file that slips in.
describe('Dataform model set', () => {
  const listDefinitions = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return listDefinitions(full);
      return [path.relative(DATAFORM_ROOT, full)];
    });

  test('definitions/ holds exactly the models real traffic needs', () => {
    expect(listDefinitions(path.join(DATAFORM_ROOT, 'definitions')).sort()).toEqual(
      [
        'definitions/assertions/assert_source_freshness.sqlx',
        'definitions/assertions/assert_stg_events.sqlx',
        'definitions/assertions/assert_stg_sessions.sqlx',
        'definitions/marts/mart_session_events.sqlx',
        'definitions/sources/raw_sources.sqlx',
        'definitions/staging/stg_events.sqlx',
        'definitions/staging/stg_sessions.sqlx',
      ].sort(),
    );
  });

  // The generated data dictionary queried INFORMATION_SCHEMA for the marts it
  // described; with those marts gone the markdown copy would describe tables
  // Dataform no longer builds.
  test('the data dictionary is gone along with the marts it described', () => {
    expect(fs.existsSync(path.join(DATAFORM_ROOT, 'DATA_DICTIONARY.md'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Staging models
// ---------------------------------------------------------------------------
describe('Staging models', () => {
  const stagingModels = [
    'definitions/staging/stg_events.sqlx',
    'definitions/staging/stg_sessions.sqlx',
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

  test('stg_events deduplicates with ROW_NUMBER and deterministic ordering', () => {
    const sql = readSqlx('definitions/staging/stg_events.sqlx');
    expect(sql).toContain('ROW_NUMBER()');
    expect(sql).toContain('_row_num = 1');
    // Tiebreaker columns ensure deterministic dedup
    expect(sql).toContain('ORDER BY page_path');
  });

  test('stg_events event_id hash uses pipe delimiters to prevent collisions', () => {
    const sql = readSqlx('definitions/staging/stg_events.sqlx');
    // Pipe delimiters between fields prevent boundary-shift collisions
    // e.g. CONCAT('a', '|', 'bc') != CONCAT('ab', '|', 'c')
    expect(sql).toContain("'|'");
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
});

// ---------------------------------------------------------------------------
// Mart models
// ---------------------------------------------------------------------------
describe('Mart models', () => {
  test('mart_session_events joins events to their sessions and targets iampatterson_marts', () => {
    const sql = readSqlx('definitions/marts/mart_session_events.sqlx');
    expect(sql).toContain('ref("stg_events")');
    expect(sql).toContain('ref("stg_sessions")');
    expect(sql).toContain('schema: "iampatterson_marts"');
  });
});

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
describe('Dataform assertions', () => {
  const assertions = [
    'definitions/assertions/assert_stg_events.sqlx',
    'definitions/assertions/assert_stg_sessions.sqlx',
    'definitions/assertions/assert_source_freshness.sqlx',
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

  // Strip comments: the prose explains what the SQL deliberately does not do,
  // so asserting over the raw text would read the explanation as the code.
  const code = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
  const freshness = () => code(readSqlx('definitions/assertions/assert_source_freshness.sqlx'));

  // Retuned in 18.1. The 24-hour check over all rows failed 13 of the nightly
  // runs from 2026-09-07 to 2026-11-08, every one a Sunday or Monday after the
  // generator's idle weekend, and it would fail most nights once the generator
  // stops: real traffic is about ten events a day with many days at zero.
  // Counting only real rows makes its verdict the same before and after the
  // generator goes, which is what lets the failure alert stay quiet through 18.9.
  test('assert_source_freshness counts real traffic only, so the generator cannot keep it green', () => {
    expect(freshness()).toMatch(/is_synthetic\s*=\s*FALSE/);
  });

  // Measured over the 60 runs from 2026-09-17 to 2026-11-15: the longest wait
  // since the last real event at 04:00 UTC was 177 hours (7.4 days). Seven days
  // would have failed once; fourteen failed none and still fires sixteen days
  // sooner than the thirty-day real-session check in assert_stg_sessions.
  test('assert_source_freshness tolerates fourteen quiet days, twice the longest measured', () => {
    expect(freshness()).toContain('INTERVAL 14 DAY');
    expect(freshness()).not.toMatch(/>\s*24\b/);
  });

  // event_timestamp prefers the browser's clock, so one visitor with a clock
  // set ahead keeps MAX(event_timestamp) in the future and the check green for
  // as long as the skew lasts (the 10c future-date scrub, whose record left with
  // infrastructure/bigquery/backfills/ in 18.1 and is in git history, removed 3,262 such
  // rows). received_at is sGTM's own clock: when the pipeline last delivered.
  test('assert_source_freshness measures arrival time, not the client clock', () => {
    expect(freshness()).toContain('MAX(received_at)');
    expect(freshness()).not.toContain('event_timestamp');
  });

  // An aggregate over zero rows returns one row of NULLs, and a comparison
  // against NULL is never true, so the old HAVING clause passed a table with no
  // rows at all. With the real-only filter that is the exact state a dead
  // pipeline produces, so it has to fail.
  test('assert_source_freshness fails when there is no real event at all', () => {
    expect(freshness()).toMatch(/MAX\(received_at\)\s+IS\s+NULL/);
  });

  // Removed in 18.1. It counted weekdays with zero events, a model of the
  // generator's weekday schedule; on real traffic 12 of the 21 weekdays to
  // 2026-11-14 had no real event, a gap rate of 0.571 against its 0.10
  // threshold, so it would fail the first night after the generator stops.
  // A dead pipeline is caught by the freshness check above.
  test("assert_volume_anomaly is gone, because it modelled the generator's schedule", () => {
    expect(
      fs.existsSync(path.join(DATAFORM_ROOT, 'definitions/assertions/assert_volume_anomaly.sqlx')),
    ).toBe(false);
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
