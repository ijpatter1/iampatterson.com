/**
 * Assert the shape of a compiled Dataform graph.
 *
 * `dataform compile` exits 0 whenever the graph *resolves*, whatever the SQL
 * says — so it catches a broken `ref()` and nothing else. The failure this
 * project actually names for a `@dataform/core` major is the silent one: the
 * marts stop rebuilding with no error. A count check is the cheap half of
 * catching that, and it is what makes the compile job judge a bump rather
 * than merely run against it.
 *
 * Importable without side effects: `EXPECTED` and `findGraph` are module-level
 * exports and the CLI body runs only under the `invokedDirectly` guard at the
 * bottom. Without that guard, importing this file ran the CLI against
 * `process.argv[2]` — under jest that is the test file path, so it reported
 * "no compiled graph found" and called `process.exit(1)`, killing the suite
 * that imported it.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Expected object counts, measured 2026-09-12 against @dataform/core 2.9.0.
 * Exported so the test fixtures derive from it rather than restating it — a
 * hardcoded copy means a legitimate new mart fails in two places, naming the
 * fixture instead of the model.
 */
export const EXPECTED = { tables: 14, assertions: 6, declarations: 2 };

/**
 * The CLI emits CONCATENATED top-level JSON documents: a small `{level,message}`
 * log object, then the graph. Taking the first one yields zero tables and reads
 * as a vanished model set, so every document is scanned and the one carrying
 * `tables` wins. Found by testing the checker against a real graph, where the
 * first-object version reported 0/0/0 on a graph holding 14 tables.
 */
export function findGraph(raw) {
  let i = 0;
  while (i < raw.length) {
    const start = raw.indexOf('{', i);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let k = start; k < raw.length; k += 1) {
      const ch = raw[k];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = k + 1;
          break;
        }
      }
    }
    if (end === -1) return null;
    try {
      const obj = JSON.parse(raw.slice(start, end));
      if (obj && typeof obj === 'object' && Array.isArray(obj.tables)) return obj;
    } catch {
      /* not a complete document; keep scanning */
    }
    i = end;
  }
  return null;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: dataform-graph-check.mjs <compiled-graph.json>');
    process.exit(2);
  }

  const graph = findGraph(readFileSync(file, 'utf8'));
  if (graph === null) {
    console.error(`no compiled graph found in ${file} — the compile step produced nothing parseable`);
    process.exit(1);
  }

  const compilationErrors = graph.graphErrors?.compilationErrors ?? [];
  if (compilationErrors.length > 0) {
    console.error(`compilation errors: ${compilationErrors.length}`);
    for (const e of compilationErrors.slice(0, 5)) console.error(`  ${e.fileName}: ${e.message}`);
    process.exit(1);
  }

  const actual = {
    tables: (graph.tables ?? []).length,
    assertions: (graph.assertions ?? []).length,
    declarations: (graph.declarations ?? []).length,
  };
  console.log(`compiled graph: ${JSON.stringify(actual)}`);

  const drifted = Object.keys(EXPECTED).filter((k) => actual[k] !== EXPECTED[k]);
  if (drifted.length > 0) {
    for (const k of drifted) console.error(`${k}: expected ${EXPECTED[k]}, got ${actual[k]}`);
    console.error(
      'The compiled model set changed. If that is intended - a model was added or ' +
        'removed - update EXPECTED in this file in the same commit. If it was not ' +
        'intended, a core bump changed the graph without failing the compile, which ' +
        'is the failure this check exists for.',
    );
    process.exit(1);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (invokedDirectly) main();
