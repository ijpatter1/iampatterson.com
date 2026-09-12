/**
 * The graph-shape checker has to be right about a graph it will mostly see
 * healthy, so its failure paths are the part worth testing.
 *
 * It already shipped one bug: the first version read the FIRST top-level JSON
 * document in `dataform compile --json` output, which is a `{level,message}`
 * log line, and reported 0 tables on a graph holding 14. That version passed a
 * hand-check against a drifted fixture too, because both runs exited 1 — the
 * proof did not discriminate. These cases pin both directions apart.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EXPECTED, findGraph } from '../../../scripts/dataform-graph-check.mjs';

const SCRIPT = path.join(process.cwd(), 'scripts', 'dataform-graph-check.mjs');
const dir = mkdtempSync(path.join(tmpdir(), 'graphcheck-'));

/** The CLI emits a log object and then the graph, concatenated. */
const withLogPreamble = (graph: unknown) =>
  `${JSON.stringify({ level: 'info', message: 'Compiling...' })}\n${JSON.stringify(graph, null, 2)}\n`;

// Derived from the checker's own constant, so adding a model means editing
// EXPECTED once rather than EXPECTED plus two fixtures.
const healthy = {
  tables: Array.from({ length: EXPECTED.tables }, (_, i) => ({ target: { name: `t${i}` } })),
  assertions: Array.from({ length: EXPECTED.assertions }, (_, i) => ({
    target: { name: `a${i}` },
  })),
  declarations: Array.from({ length: EXPECTED.declarations }, (_, i) => ({
    target: { name: `d${i}` },
  })),
  graphErrors: {},
};

function run(contents: string): { code: number; out: string } {
  const file = path.join(dir, `g-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, contents);
  try {
    const out = execFileSync('node', [SCRIPT, file], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('dataform-graph-check', () => {
  it('passes a healthy graph that is preceded by a log document', () => {
    // The regression case. A scanner that takes the first object sees
    // {level,message}, finds no tables, and reports a vanished model set.
    const { code, out } = run(withLogPreamble(healthy));
    expect(code).toBe(0);
    expect(out).toContain(`"tables":${EXPECTED.tables}`);
  });

  it('fails when a model disappears without the compile failing', () => {
    // The failure the job exists for: `dataform compile` exits 0 whenever the
    // graph resolves, so a lost mart is silent until something counts.
    const short = { ...healthy, tables: healthy.tables.slice(0, -1) };
    const { code, out } = run(withLogPreamble(short));
    expect(code).not.toBe(0);
    expect(out).toContain(`expected ${EXPECTED.tables}, got ${EXPECTED.tables - 1}`);
  });

  it('fails on compilation errors even when the counts would match', () => {
    const broken = {
      ...healthy,
      graphErrors: {
        compilationErrors: [{ fileName: 'x.sqlx', message: 'Could not resolve "y"' }],
      },
    };
    const { code, out } = run(withLogPreamble(broken));
    expect(code).not.toBe(0);
    expect(out).toContain('compilation errors');
  });

  it('fails loudly, not silently, when the output holds no graph at all', () => {
    const { code, out } = run('not json at all\n');
    expect(code).not.toBe(0);
    expect(out).toContain('no compiled graph found');
  });

  // Direct cover for the scanner itself, which is hand-rolled and shipped the
  // bug described above. The cases below pin the specific behaviour that broke:
  // picking the graph out of CONCATENATED top-level documents rather than
  // taking the first one.
  it('findGraph skips a leading log document and returns the one holding tables', () => {
    const raw = `${JSON.stringify({ level: 'info', message: 'Compiling...' })}\n${JSON.stringify(healthy)}`;
    const graph = findGraph(raw) as typeof healthy | null;
    expect(graph).not.toBeNull();
    expect(graph?.tables).toHaveLength(EXPECTED.tables);
  });

  it('findGraph returns null rather than a partial object when nothing parses', () => {
    expect(findGraph('garbage { not json')).toBeNull();
  });
});
