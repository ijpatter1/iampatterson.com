/**
 * The session key must survive GA4's reserved-parameter remapping.
 *
 * `session_id` is reserved in gtag.js, which treats it as a configuration
 * field and consumes it before the hit is built — so `ep.session_id` never
 * leaves the page and every row reaching `iampatterson_raw.events_raw` from a
 * real browser has it NULL. The generator is not exempt because it bypasses
 * the GA4 client (it posts to the same /g/collect endpoint with the same v=2
 * protocol) but because it hand-builds the query string and sets
 * ep.session_id explicitly. So the column looks healthy in aggregate and is
 * empty for every actual visitor.
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

  it('exposes the resolved key AS session_id, which is what stg_sessions filters on', () => {
    // The load-bearing line, and the one the first version of these tests did
    // not pin: reverting just this to a bare `session_id` restored the bug
    // while every other assertion here stayed green. stg_sessions filters
    // `WHERE session_id IS NOT NULL`, so this SELECT-list entry is the whole
    // repair as far as the warehouse is concerned.
    expect(body).toMatch(
      /COALESCE\(\s*iap_session_id\s*,\s*session_id\s*\)\s+AS\s+session_id/,
    );
  });

  it('prefers iap_session_id, the field GA4 will not rewrite', () => {
    // pubsub-tag-template.js:54 resolves iap_session_id first and never reads
    // session_id. Matching that order means the warehouse and the real-time
    // overlay key a visitor identically by construction, not by the accident
    // that GA4 currently leaves session_id empty.
    expect(body).not.toMatch(/COALESCE\(\s*session_id\s*,\s*iap_session_id/);
  });

  it('deduplicates on the resolved key, not on the column GA4 empties', () => {
    // PARTITION BY ... session_id ... groups every real event under NULL, so
    // ROW_NUMBER collapses unrelated events from different visitors into one
    // partition and the dedup filter discards them as duplicates.
    const partition = body.match(/PARTITION BY([\s\S]*?)ORDER BY/)?.[1] ?? '';
    expect(partition).toContain('iap_session_id');
    // page_path too: the partition was coarser than the event_id hash, which
    // includes it, so dedup discarded rows the identity function calls
    // distinct — two GA4 auto page_views on different pages in the same
    // server millisecond.
    expect(partition).toContain('page_path');
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

/**
 * `is_synthetic` must actually mean synthetic (review findings, 2026-09-08).
 *
 * It was derived from `iap_source`, which is the marker for *our instrumented
 * events* — the real site sets it at `track.ts` and the generator sets it at
 * `transport.ts`, both to 'true'. It separated our events from GA4's
 * enhanced-measurement hits, which is a different question from the one its
 * name asks. Measured: 35,635 generator rows and 83 real browser rows all
 * carry `iap_source = 'true'`.
 *
 * That was invisible until now for the same reason the assertion was: no real
 * session reached `stg_sessions` at all, so nobody could see the mislabel. The
 * moment the session key is resolved, twelve real sessions arrive labelled
 * synthetic and every dashboard that splits on the column still answers
 * "nobody".
 */
describe('is_synthetic distinguishes the generator, not our instrumentation', () => {
  const body = code(stgEvents);

  it('is not derived from iap_source, which the real site also sends', () => {
    expect(body).not.toMatch(/iap_source\s*=\s*'true'[\s\S]{0,80}AS\s+is_synthetic/);
  });

  it('reads the generator marker the generator actually sends', () => {
    expect(body).toContain('iap_synthetic');
  });

  it('falls back to the generator user agent, so existing history is labelled too', () => {
    // The marker only appears on rows written after the generator deploys.
    // Everything already in the 60-day raw window predates it, and the
    // generator's user agent is the discriminator those rows do carry.
    expect(body).toContain('iampatterson-data-generator');
  });
});

describe('the generator identifies itself', () => {
  const transport = fs.readFileSync(
    path.join(process.cwd(), 'infrastructure/cloud-run/data-generator/src/transport.ts'),
    'utf-8',
  );

  it('sends an explicit synthetic marker the browser never sends', () => {
    // iap_source cannot carry this: the real site sends it too, by design,
    // because it means "our event" rather than "our generator".
    expect(transport).toContain("params.set('ep.iap_synthetic', 'true')");
  });

  it('keeps sending iap_source, which the sGTM Pub/Sub tag still gates on', () => {
    // pubsub-tag-template.js drops any event without it, so removing it would
    // silently stop the generator feeding the real-time overlay.
    expect(transport).toContain("params.set('ep.iap_source', 'true')");
  });
});
