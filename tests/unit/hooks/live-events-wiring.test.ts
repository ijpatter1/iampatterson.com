/**
 * Every `useLiveEvents` call site must pass the visitor's analytics consent.
 *
 * The hook tests prove the hook. Nothing proved the call sites — a review
 * demonstrated that deleting the `{ analyticsConsent }` argument from
 * `overlay-view.tsx` left the entire suite green while reintroducing the
 * reported bug, because every overlay suite mocks the hook as a zero-argument
 * factory (`useLiveEvents: () => ({ events: [], source: 'dataLayer' })`).
 *
 * A source-level pin is the honest instrument here: the mocks are what make a
 * behavioural test blind, so asserting on the mocked seam would inherit the
 * blindness. `tests/unit/infra/workflow-injection.test.ts` uses the same shape
 * for the same reason.
 *
 * The bug this guards: `useLiveEvents` picks one source behind a sticky latch,
 * and [14.1]'s consent gate exempts exactly one tag — so a declining visitor's
 * single `consent_update` reaches the server, latches the source to SSE, and
 * every subsequent event is discarded. It only reproduces where
 * NEXT_PUBLIC_EVENT_STREAM_URL is set, which is production.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const CALL_SITES = [
  'src/components/overlay/overlay-view.tsx',
  'src/components/home/pipeline-editorial.tsx',
  'src/hooks/useSessionContext.ts',
];

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('every useLiveEvents call site is consent-aware', () => {
  it('finds the call sites it claims to check, so a rename is not a silent pass', () => {
    for (const rel of CALL_SITES) {
      expect(read(rel)).toMatch(/useLiveEvents\s*\(/);
    }
  });

  it.each(CALL_SITES)('%s passes analyticsConsent', (rel) => {
    const src = read(rel);
    // The bare zero-argument form is the bug.
    expect(src).not.toMatch(/useLiveEvents\(\s*\)/);
    expect(src).toMatch(/useLiveEvents\(\s*\{[^}]*analyticsConsent[^}]*\}\s*\)/);
  });

  it('no call site outside the checked list has appeared', () => {
    // A new consumer that forgets consent is the same bug in a new place, and
    // the list above cannot catch what it does not know about.
    const roots = ['src/components', 'src/hooks', 'src/app'];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(path.join(process.cwd(), dir))) {
        const rel = `${dir}/${entry}`;
        const full = path.join(process.cwd(), rel);
        if (statSync(full).isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(entry) && !/useLiveEvents\.ts$/.test(entry)) {
          if (/useLiveEvents\s*\(/.test(readFileSync(full, 'utf8'))) found.push(rel);
        }
      }
    };
    roots.forEach(walk);
    expect(found.sort()).toEqual([...CALL_SITES].sort());
  });
});
