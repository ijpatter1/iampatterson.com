/**
 * Pins that the ecommerce demo-entry server component invokes the Metabase
 * warmup hook via `after()` from `next/server` (Phase 10a D2), and that the
 * homepage no longer does (15.4). A source sniff beats a full SSR render
 * here: the pages are very thin Server Components whose only testable
 * behavior on this axis is the presence and invocation-shape of the hook
 * call.
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
  // 15.4: the homepage no longer warms Metabase. The redesigned homepage
  // embeds no dashboard, so a warmup on every visit would spend BigQuery for
  // nothing, and forcing dynamic rendering for it would give up the static
  // page. The ecommerce entry keeps its warmup until 17.1 removes it.
  it('homepage does not import or schedule the warmup, and renders statically', () => {
    const src = read(HOMEPAGE_PATH);
    expect(src).not.toMatch(/keep-warm|warmMetabaseDashboard/);
    expect(src).not.toMatch(/\bafter\s*\(/);
    expect(src).not.toMatch(/from\s*['"]next\/server['"]/);
    expect(src).not.toMatch(/export\s+const\s+dynamic\b/);
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
