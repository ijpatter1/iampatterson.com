/**
 * The golden suite must collect offline whatever GOLDEN_REPEAT says (20.1
 * gate). describe.skip still runs its body, so a parse at collection time
 * turned a leftover invalid value into a failed `npm test` with no live
 * call in sight. Spawns jest on golden.test.ts with GOLDEN_TEST unset.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('golden suite collection (offline)', () => {
  it('collects and passes with an invalid GOLDEN_REPEAT and GOLDEN_TEST unset', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, GOLDEN_REPEAT: 'three' };
    delete env.GOLDEN_TEST;
    const root = path.join(__dirname, '..');
    const result = spawnSync(
      process.execPath,
      [require.resolve('jest/bin/jest'), '--config', 'jest.config.json', 'src/golden.test.ts'],
      { cwd: root, env, encoding: 'utf8' },
    );
    expect(result.stderr).toMatch(/Tests:.*passed/);
    expect(result.status).toBe(0);
  }, 60000);
});
