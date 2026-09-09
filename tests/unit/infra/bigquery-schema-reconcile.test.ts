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
import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const root = path.join(__dirname, '..', '..', '..');
const setup = fs.readFileSync(path.join(root, 'infrastructure/bigquery/setup.sh'), 'utf-8');
const schema = JSON.parse(
  fs.readFileSync(path.join(root, 'infrastructure/bigquery/schema.json'), 'utf-8'),
) as { name: string; type: string; mode: string }[];

/** Strip comments so a shell comment describing the fix cannot satisfy a check. */
const code = setup.replace(/^\s*#.*$/gm, '');

/**
 * The comparison the reconcile decides on, executed.
 *
 * The first version of these tests pinned `setup.sh`'s source text. The review
 * disproved them by mutation: replacing the entire reconcile block with
 * `echo "TODO: run bq update --schema..."` left all six assertions green,
 * because the regex matched the echo string. A test that cannot fail is worse
 * than none — it occupies the place a real check would go, which is the same
 * lesson `assert_stg_sessions` taught earlier in this session.
 *
 * So the decision logic moved out of the shell into `schema-diff.py`, where it
 * takes two files and needs no BigQuery. These run it.
 */
describe('schema-diff decides on the schemas, not on a column count', () => {
  const script = path.join(root, 'infrastructure/bigquery/schema-diff.py');

  /** Run the differ over two fixture schemas; returns [exitCode, stdout]. */
  function diff(live: object[], declared: object[]): [number, string] {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-diff-'));
    const a = path.join(dir, 'live.json');
    const b = path.join(dir, 'declared.json');
    fs.writeFileSync(a, JSON.stringify(live));
    fs.writeFileSync(b, JSON.stringify(declared));
    const res = spawnSync('python3', [script, a, b], { encoding: 'utf-8' });
    return [res.status ?? -1, res.stdout];
  }

  const col = (name: string, type = 'STRING', mode = 'NULLABLE') => ({ name, type, mode });

  it('is silent and exits 0 when the schemas match', () => {
    const same = [col('event_name', 'STRING', 'REQUIRED'), col('direction')];
    const [code, out] = diff(same, same);
    expect(code).toBe(0);
    expect(out.trim()).toBe('');
  });

  it('reports a declared column the table lacks', () => {
    const [code, out] = diff([col('a')], [col('a'), col('metric_name')]);
    expect(code).toBe(1);
    expect(out).toContain('metric_name');
  });

  it('catches a RENAME, which leaves the column count unchanged', () => {
    // The defect the count check could not see: 1 column before, 1 after, and
    // the payload silently dropped at the write.
    const [code, out] = diff([col('max_scroll_pct', 'INTEGER')], [col('scroll_pct_max', 'INTEGER')]);
    expect(code).toBe(1);
    expect(out).toContain('scroll_pct_max');
    expect(out).toContain('max_scroll_pct');
  });

  it('catches a TYPE change, which also leaves the count unchanged', () => {
    const [code, out] = diff([col('metric_value', 'STRING')], [col('metric_value', 'FLOAT')]);
    expect(code).toBe(1);
    expect(out).toMatch(/metric_value.*STRING.*FLOAT/);
  });

  it('catches a MODE change', () => {
    const [code, out] = diff(
      [col('event_name', 'STRING', 'NULLABLE')],
      [col('event_name', 'STRING', 'REQUIRED')],
    );
    expect(code).toBe(1);
    expect(out).toContain('event_name');
  });

  it('treats an omitted mode as NULLABLE, which is what bq emits', () => {
    // bq show omits `mode` for nullable columns. Without this the differ would
    // report every nullable column as changed on every run.
    const [code] = diff([{ name: 'a', type: 'STRING' }], [col('a', 'STRING', 'NULLABLE')]);
    expect(code).toBe(0);
  });

  it('reports a live column that is no longer declared, which bq cannot drop', () => {
    const [code, out] = diff([col('a'), col('gone')], [col('a')]);
    expect(code).toBe(1);
    expect(out).toContain('cannot drop');
  });

  it('agrees the committed schema matches itself', () => {
    // Guards the differ against the real file's shape — 77 columns, mixed
    // modes and types — rather than only hand-made fixtures.
    const declared = JSON.parse(
      fs.readFileSync(path.join(root, 'infrastructure/bigquery/schema.json'), 'utf-8'),
    );
    expect(diff(declared, declared)[0]).toBe(0);
  });
});

describe('setup.sh calls the differ rather than counting', () => {
  it('no longer decides on a column count', () => {
    // The specific short-circuit the review found: equal counts meant "already
    // matches", so any count-preserving change was skipped.
    expect(code).not.toMatch(/BEFORE.*-eq.*DECLARED/);
  });

  it('runs the differ before deciding, and again after updating', () => {
    const calls = code.match(/schema-diff\.py/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
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
