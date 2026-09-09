/**
 * `setup.sh` must reconcile the events table's schema, not only create it.
 *
 * It created the table from `schema.json` and, when the table already existed,
 * printed "already exists, skipping" and stopped. Every column added to
 * `schema.json` after the table was made was therefore committed and never
 * applied.
 *
 * Measured 2026-09-09: the live table had 50 columns against 77 declared. The
 * 27 missing ones were all seven Web Vitals and engagement parameters, all
 * fifteen Claudish parameters, `iap_synthetic`, and four others. The sGTM
 * BigQuery tag writes `fullEventData` and BigQuery silently discards fields
 * with no matching column, so those events landed with their payloads dropped:
 * present by `event_name`, empty of every measurement that made them worth
 * collecting.
 *
 * That is why this is worth a test rather than a one-off `bq update`. The
 * defect was not the missing columns, it was that nothing reconciled and
 * nothing compared. The same shape had already appeared twice this session in
 * the GTM server container spec and the Dataform session key.
 *
 * The reconcile itself is only exercisable against BigQuery, which this suite
 * has no credentials for and should not acquire — a test that skips without
 * them cannot fail when the logic changes. So this pins the script's shape,
 * and the operator-facing proof is the recorded column count in
 * `docs/verification/`.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..', '..', '..');
const setup = fs.readFileSync(path.join(root, 'infrastructure/bigquery/setup.sh'), 'utf-8');
const schema = JSON.parse(
  fs.readFileSync(path.join(root, 'infrastructure/bigquery/schema.json'), 'utf-8'),
) as { name: string; type: string; mode: string }[];

/** Strip comments so a shell comment describing the fix cannot satisfy a check. */
const code = setup.replace(/^\s*#.*$/gm, '');

describe('setup.sh reconciles the events table schema', () => {
  it('updates the schema when the table already exists', () => {
    // The whole defect in one assertion: the existing-table branch used to
    // print "skipping" and do nothing.
    expect(code).toMatch(/bq[\s\S]{0,80}update[\s\S]{0,200}--schema/);
  });

  it('no longer skips silently on an existing table', () => {
    // Scoped to the TABLE branch. The dataset branch still skips, correctly:
    // a dataset has no schema to reconcile.
    const tableBranch = code.slice(code.indexOf('${DATASET}.${TABLE}"'));
    expect(tableBranch).not.toMatch(/Table .* already exists, skipping/);
  });

  it('reports the column count so a partial apply is visible', () => {
    // A reconcile that says nothing is only marginally better than one that
    // does nothing: the operator needs to see the table caught up.
    expect(code).toMatch(/columns?/i);
  });
});

describe('schema.json is additive-only, which is what makes reconciling safe', () => {
  it('adds no REQUIRED column beyond the two the table was created with', () => {
    // `bq update` can add NULLABLE columns to a populated table without a
    // rewrite and without touching existing rows. A REQUIRED column cannot be
    // added to an existing table at all, so declaring a new one would turn
    // every future reconcile into a manual migration — and would fail on this
    // table specifically, which already holds hundreds of thousands of rows.
    //
    // event_name and received_timestamp predate the table and are exempt
    // because they are already REQUIRED in BigQuery; nothing is being added.
    const required = schema.filter((c) => c.mode !== 'NULLABLE').map((c) => c.name).sort();
    expect(required).toEqual(['event_name', 'received_timestamp']);
  });

  it('names no duplicate columns', () => {
    const names = schema.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('carries the parameters of every event the container now sends', () => {
    // The columns whose absence made tonight's landed events hollow. Pinned by
    // name because the failure is silent at every layer: GTM sends them,
    // BigQuery drops them, and nothing errors.
    const names = new Set(schema.map((c) => c.name));
    for (const column of [
      'metric_name',
      'metric_value',
      'metric_rating',
      'metric_id',
      'navigation_type',
      'engagement_seconds',
      'max_scroll_pct',
      'direction',
      'outcome',
      'ttft_ms',
      'duration_ms',
      'cache',
      'share_action',
      'rating',
      'iap_synthetic',
    ]) {
      expect(names).toContain(column);
    }
  });
});
