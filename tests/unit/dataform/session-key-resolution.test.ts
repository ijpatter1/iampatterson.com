/**
 * The session key must survive GA4's reserved-parameter remapping.
 *
 * `session_id` is a reserved GA4 parameter name. The GA4 client in sGTM
 * consumes it, so every row that reaches `iampatterson_raw.events_raw` from a
 * real browser has `session_id` NULL. The data generator posts directly to
 * sGTM, bypassing that client, so its rows keep the field — which is why the
 * column looks healthy in aggregate and is empty for every actual visitor.
 *
 * Measured 2026-09-08: 44/44 real rows null, 541/541 generator rows populated.
 * `iap_session_id` was added in March 2026 (session-2026-03-27-007.md) exactly
 * because GA4 will not remap it, and it is present on 100% of real rows. Only
 * the sGTM Pub/Sub tag was ever taught to read it; the warehouse was not.
 *
 * The consequence, measured the same day: `stg_sessions` held 193,323
 * sessions, every one `is_synthetic = true`. Zero real visitors, because
 * `stg_sessions` filters `WHERE session_id IS NOT NULL`. Every mart above it —
 * customer LTV, lead funnel, channel attribution, ecommerce funnel,
 * subscription cohorts, campaign performance, session events — and every
 * Metabase dashboard above those described the data generator alone.
 *
 * Fixing it at the staging boundary means every downstream model inherits the
 * repair without a change, which is why these assertions live on stg_events.
 */
import * as fs from 'fs';
import * as path from 'path';

const DATAFORM_ROOT = path.join(process.cwd(), 'infrastructure/dataform');
const readSqlx = (rel: string) => fs.readFileSync(path.join(DATAFORM_ROOT, rel), 'utf-8');

const stgEvents = readSqlx('definitions/staging/stg_events.sqlx');
const assertSessions = readSqlx('definitions/assertions/assert_stg_sessions.sqlx');

/** Strip SQL and JS comments so a mention in prose cannot satisfy an assertion. */
const code = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');

describe('stg_events resolves a session key that real traffic actually has', () => {
  const body = code(stgEvents);

  it('falls back to iap_session_id when GA4 has emptied session_id', () => {
    expect(body).toMatch(/COALESCE\(\s*session_id\s*,\s*iap_session_id\s*\)/);
  });

  it('deduplicates on the resolved key, not on the column GA4 empties', () => {
    // PARTITION BY ... session_id ... groups every real event under NULL, so
    // ROW_NUMBER collapses unrelated events from different visitors into one
    // partition and the dedup filter discards them as duplicates.
    const partition = body.match(/PARTITION BY([\s\S]*?)ORDER BY/)?.[1] ?? '';
    expect(partition).toContain('iap_session_id');
  });

  it('hashes event_id on the resolved key, so real events get distinct ids', () => {
    // COALESCE(session_id, '') inside the hash means every real event hashes
    // on an empty string in that position — identity derived from a field the
    // row does not have.
    const hash = body.match(/SHA256\(CONCAT\(([\s\S]*?)\)\)\)/)?.[1] ?? '';
    expect(hash).toContain('iap_session_id');
  });
});

describe('assert_stg_sessions can actually fail', () => {
  const body = code(assertSessions);

  it('does not assert a predicate its own source table already filters out', () => {
    // The vacuity that hid this for months: the assertion selected rows
    // WHERE session_id IS NULL from stg_sessions, a model whose own WHERE
    // clause removes exactly those rows. It could never return one, and
    // reported green over an empty real-traffic set throughout.
    const stgSessions = code(readSqlx('definitions/staging/stg_sessions.sqlx'));
    const modelFiltersNulls = /WHERE\s+session_id\s+IS\s+NOT\s+NULL/i.test(stgSessions);
    const assertionChecksNulls = /session_id\s+IS\s+NULL/i.test(body);
    expect(modelFiltersNulls && assertionChecksNulls).toBe(false);
  });

  it('asserts that real sessions exist, which is the thing that was false', () => {
    // An assertion over synthetic-only data passes forever while the warehouse
    // describes nobody. This is the check that would have caught it on day one.
    expect(body).toContain('is_synthetic');
  });
});
