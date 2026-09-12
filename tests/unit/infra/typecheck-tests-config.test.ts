/**
 * @jest-environment node
 *
 * The debt ledger has to be able to report a non-zero number.
 *
 * tsconfig.json excludes tests/** so the Next 16.3 build can pass (54 errors
 * live there). tsconfig.test.json exists to keep those files checkable, and it
 * overrides `exclude` to drop "tests" — inheriting the parent's exclude would
 * filter the include set down to nothing, tsc would exit 0, and
 * `npm run typecheck:tests` would report zero debt while checking no files.
 *
 * That is a silent green, so it gets a test rather than a comment alone.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (f: string): string => readFileSync(path.join(process.cwd(), f), 'utf8');
// tsconfigs carry comments and tolerate trailing commas; strip both before
// parsing. Without the trailing-comma pass, deleting a key makes JSON.parse throw
// and this suite reports "0 total" — a failure shape indistinguishable from a
// harness problem, which is the ambiguity these tests exist to remove.
const parseJsonc = (raw: string): Record<string, unknown> =>
  JSON.parse(
    raw
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/,(\s*[}\]])/g, '$1'),
  ) as Record<string, unknown>;

describe('the test-typecheck program is real, not empty', () => {
  const testCfg = parseJsonc(read('tsconfig.test.json'));
  const buildCfg = parseJsonc(read('tsconfig.json'));

  it('excludes tests from the build program, which is why the ledger exists', () => {
    expect(buildCfg.exclude).toContain('tests');
  });

  it('does NOT inherit that exclusion, or the ledger silently reads zero', () => {
    const exclude = testCfg.exclude as string[] | undefined;
    expect(exclude).toBeDefined();
    expect(exclude).not.toContain('tests');
  });

  it('actually includes the files it claims to check', () => {
    const include = testCfg.include as string[];
    expect(include.some((p) => p.startsWith('tests/'))).toBe(true);
  });

  it('is wired to a script, so the count is reachable', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['typecheck:tests']).toContain('tsconfig.test.json');
  });
});
