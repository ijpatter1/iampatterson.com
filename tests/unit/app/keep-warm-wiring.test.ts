/**
 * Pins that the homepage and ecommerce demo-entry server components both
 * invoke the fire-and-forget Metabase warmup hook (Phase 9F D9). A source
 * sniff beats a full SSR render here: the pages are very thin Server
 * Components whose only testable behavior on this axis is the presence
 * and invocation-shape of the hook call. Guards against a refactor that
 * accidentally drops the import or the call.
 */
import * as fs from 'fs';
import * as path from 'path';

const HOMEPAGE_PATH = path.resolve(__dirname, '../../../src/app/page.tsx');
const DEMO_ENTRY_PATH = path.resolve(__dirname, '../../../src/app/demo/ecommerce/page.tsx');

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

describe('Metabase keep-warm wiring (Phase 9F D9)', () => {
  it('homepage imports and invokes warmMetabaseDashboardFireAndForget', () => {
    const src = read(HOMEPAGE_PATH);
    expect(src).toMatch(
      /import\s*\{[^}]*warmMetabaseDashboardFireAndForget[^}]*\}\s*from\s*['"]@\/lib\/metabase\/keep-warm['"]/,
    );
    expect(src).toMatch(/warmMetabaseDashboardFireAndForget\s*\(\s*\)\s*;/);
  });

  it('homepage does not await the warmup hook (render must never block)', () => {
    const src = read(HOMEPAGE_PATH);
    expect(src).not.toMatch(/await\s+warmMetabaseDashboardFireAndForget/);
    expect(src).not.toMatch(/await\s+warmMetabaseDashboard\b/);
  });

  // Pass-1 evaluator Critical #1, without force-dynamic the homepage is
  // statically prerendered and the warmup hook fires once at build time
  // instead of per-visitor, defeating the per-request debounce gate.
  it('homepage forces dynamic rendering so the warmup hook fires per-request', () => {
    const src = read(HOMEPAGE_PATH);
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });

  it('ecommerce demo-entry imports and invokes warmMetabaseDashboardFireAndForget', () => {
    const src = read(DEMO_ENTRY_PATH);
    expect(src).toMatch(
      /import\s*\{[^}]*warmMetabaseDashboardFireAndForget[^}]*\}\s*from\s*['"]@\/lib\/metabase\/keep-warm['"]/,
    );
    expect(src).toMatch(/warmMetabaseDashboardFireAndForget\s*\(\s*\)\s*;/);
  });

  it('ecommerce demo-entry does not await the warmup hook', () => {
    const src = read(DEMO_ENTRY_PATH);
    expect(src).not.toMatch(/await\s+warmMetabaseDashboardFireAndForget/);
    expect(src).not.toMatch(/await\s+warmMetabaseDashboard\b/);
  });

  it('ecommerce demo-entry forces dynamic rendering so the warmup hook fires per-request', () => {
    const src = read(DEMO_ENTRY_PATH);
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });
});
