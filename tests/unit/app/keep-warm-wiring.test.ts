/**
 * Pins that the homepage and ecommerce demo-entry server components both
 * invoke the Metabase warmup hook via `after()` from `next/server`
 * (Phase 10a D2). A source sniff beats a full SSR render here: the pages
 * are very thin Server Components whose only testable behavior on this
 * axis is the presence and invocation-shape of the hook call.
 *
 * `after()` runs the warmup *after* the response is flushed but *before*
 * the Vercel Lambda freezes, which closes the Phase 9F D9 Pass-2 Tech
 * Important (fire-and-forget from a Server Component risks truncated
 * BigQuery fan-out when the execution context freezes on response flush).
 */
import * as fs from 'fs';
import * as path from 'path';

const HOMEPAGE_PATH = path.resolve(__dirname, '../../../src/app/page.tsx');
const DEMO_ENTRY_PATH = path.resolve(__dirname, '../../../src/app/demo/ecommerce/page.tsx');

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

describe('Metabase keep-warm wiring via next/server after() (Phase 10a D2)', () => {
  it('homepage imports `after` from next/server and the async warmup function', () => {
    const src = read(HOMEPAGE_PATH);
    expect(src).toMatch(/import\s*\{[^}]*\bafter\b[^}]*\}\s*from\s*['"]next\/server['"]/);
    expect(src).toMatch(
      /import\s*\{[^}]*\bwarmMetabaseDashboard\b[^}]*\}\s*from\s*['"]@\/lib\/metabase\/keep-warm['"]/,
    );
  });

  it('homepage schedules the warmup inside `after(() => warmMetabaseDashboard())`', () => {
    const src = read(HOMEPAGE_PATH);
    // Permissive match on the callback form; what matters is that the call
    // is wrapped by `after(`, not how the arrow is formatted.
    expect(src).toMatch(/after\s*\(\s*\(\s*\)\s*=>\s*warmMetabaseDashboard\s*\(/);
  });

  it('homepage does not call the legacy fire-and-forget variant', () => {
    const src = read(HOMEPAGE_PATH);
    expect(src).not.toMatch(/warmMetabaseDashboardFireAndForget/);
  });

  it('homepage does not await the warmup hook (render must never block)', () => {
    const src = read(HOMEPAGE_PATH);
    expect(src).not.toMatch(/await\s+warmMetabaseDashboard\b/);
  });

  // Pass-1 evaluator Critical #1 from session-2026-04-23-001: without
  // force-dynamic the homepage is statically prerendered and the warmup
  // hook fires once at build time instead of per-visitor, defeating the
  // per-request debounce gate. after() also only fires on dynamic
  // requests, so this remains load-bearing.
  it('homepage forces dynamic rendering so the warmup hook fires per-request', () => {
    const src = read(HOMEPAGE_PATH);
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });

  it('ecommerce demo-entry imports `after` from next/server and the async warmup function', () => {
    const src = read(DEMO_ENTRY_PATH);
    expect(src).toMatch(/import\s*\{[^}]*\bafter\b[^}]*\}\s*from\s*['"]next\/server['"]/);
    expect(src).toMatch(
      /import\s*\{[^}]*\bwarmMetabaseDashboard\b[^}]*\}\s*from\s*['"]@\/lib\/metabase\/keep-warm['"]/,
    );
  });

  it('ecommerce demo-entry schedules the warmup inside `after(() => warmMetabaseDashboard())`', () => {
    const src = read(DEMO_ENTRY_PATH);
    expect(src).toMatch(/after\s*\(\s*\(\s*\)\s*=>\s*warmMetabaseDashboard\s*\(/);
  });

  it('ecommerce demo-entry does not call the legacy fire-and-forget variant', () => {
    const src = read(DEMO_ENTRY_PATH);
    expect(src).not.toMatch(/warmMetabaseDashboardFireAndForget/);
  });

  it('ecommerce demo-entry does not await the warmup hook', () => {
    const src = read(DEMO_ENTRY_PATH);
    expect(src).not.toMatch(/await\s+warmMetabaseDashboard\b/);
  });

  it('ecommerce demo-entry forces dynamic rendering so the warmup hook fires per-request', () => {
    const src = read(DEMO_ENTRY_PATH);
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });
});
