/**
 * Runtime currency pins (Phase 12, deliverable 12.1).
 *
 * Vercel stops building Node 20 projects on 2026-10-01 unless
 * `engines.node` is `24.x`; the three Cloud Run services build from the
 * same major so local, Vercel and Cloud Run agree. These pins fail the
 * moment any of the four drifts back, and they keep the prose that names
 * the floor honest.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const SERVICES = ['event-stream', 'data-generator', 'claudish-proxy'];

describe('Node.js 24 runtime pins', () => {
  it('package.json engines pins Node 24.x', () => {
    const pkg = JSON.parse(read('package.json')) as { engines?: { node?: string } };
    expect(pkg.engines?.node).toBe('24.x');
  });

  it.each(SERVICES)('%s builds both Docker stages from node:24-slim', (service) => {
    const dockerfile = read(`infrastructure/cloud-run/${service}/Dockerfile`);
    // Docker accepts a lowercase `from`, leading whitespace and flag args, so a
    // matcher anchored on the literal 'FROM ' does not reject such a stage — it
    // makes it INVISIBLE. With a >= floor, a third stage written `from
    // node:20-slim` left the two uppercase lines matching and the count passing,
    // while the final stage — the one that ships — was Node 20.
    const froms = dockerfile.split('\n').filter((l) => /^\s*FROM\s+/i.test(l));
    expect(froms).toHaveLength(2);
    for (const from of froms) {
      expect(from).toMatch(/^\s*FROM\s+(--\S+\s+)*node:24(-slim)?\b/i);
    }
  });

  it('no project rule or architecture line still names Node 20 as the floor', () => {
    const prose = ['docs/ARCHITECTURE.md', '.claude/rules/project-testing.md', '.claude/rules/project-references.md', '.claude/rules/project-design-and-constraints.md', 'CLAUDE.md']
      .map((p) => `${p}:\n${read(p)}`)
      .join('\n');
    // The archive and the current-state description may name Node 20 as history;
    // the floor statement itself must not.
    expect(prose).not.toMatch(/Node\.js\s*[≥>]=?\s*20\.9/);
    expect(prose).not.toMatch(/engines\.node[^\n]*20\.x/);
  });
});
