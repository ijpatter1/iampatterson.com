/**
 * No assertion may test a predicate its own source model already filters out.
 *
 * Graduated from a single case to a rule, 2026-09-08. `assert_stg_sessions`
 * selected rows `WHERE session_id IS NULL` from `stg_sessions`, a model whose
 * own `WHERE session_id IS NOT NULL` removes exactly those rows. It could never
 * return one. It reported green for months while the table held 193,323
 * sessions of which zero were real visitors — an assertion occupying the place
 * where a real check would have gone.
 *
 * The same shape is possible in every other assertion here, and nothing looked
 * for it. This does.
 *
 * The check is deliberately narrow: it only flags `X IS NULL` in an assertion
 * whose referenced model filters `X IS NOT NULL`. That is provable from the
 * source text and has no false positives. It does not attempt to reason about
 * predicates in general — a broader check would need the SQL semantics, and a
 * check that guesses is a worse guard than one that is certain about a little.
 */
import * as fs from 'fs';
import * as path from 'path';

const DATAFORM_ROOT = path.join(process.cwd(), 'infrastructure/dataform');
const ASSERTIONS_DIR = path.join(DATAFORM_ROOT, 'definitions/assertions');

/** Strip comments so prose describing a predicate is not read as one. */
const code = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');

/** Find a model definition by name, wherever it lives under definitions/. */
function findModel(name: string): string | null {
  const roots = ['staging', 'marts', 'sources', 'intermediate'];
  for (const dir of roots) {
    const p = path.join(DATAFORM_ROOT, 'definitions', dir, `${name}.sqlx`);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  return null;
}

const assertionFiles = fs
  .readdirSync(ASSERTIONS_DIR)
  .filter((f) => f.endsWith('.sqlx'))
  .sort();

describe('Dataform assertions can fail', () => {
  it('finds the assertions to check, so an empty directory is not a silent pass', () => {
    expect(assertionFiles.length).toBeGreaterThanOrEqual(4);
  });

  it.each(assertionFiles)('%s does not check a null its source model removes', (file) => {
    const body = code(fs.readFileSync(path.join(ASSERTIONS_DIR, file), 'utf-8'));

    // Columns this assertion tests for NULL.
    const testedForNull = [...body.matchAll(/(\w+)\s+IS\s+NULL/gi)].map((m) => m[1].toLowerCase());
    if (testedForNull.length === 0) return;

    // Models it reads.
    const refs = [...body.matchAll(/\$\{ref\((?:"[^"]+",\s*)?"([^"]+)"\)\}/g)].map((m) => m[1]);

    for (const ref of refs) {
      const model = findModel(ref);
      if (!model) continue;
      const modelBody = code(model);
      const filteredNotNull = [...modelBody.matchAll(/(\w+)\s+IS\s+NOT\s+NULL/gi)].map((m) =>
        m[1].toLowerCase(),
      );
      for (const column of testedForNull) {
        // If the model guarantees the column is non-null, asserting it is null
        // is a test that cannot fail.
        expect(filteredNotNull).not.toContain(column);
      }
    }
  });
});
