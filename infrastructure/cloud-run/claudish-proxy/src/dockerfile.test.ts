/**
 * Dockerfile pins (review batch 1, 2026-09-03). Express's default error
 * handler prints stack traces unless NODE_ENV is production; the image must
 * set it so a handler slip never leaks paths.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dockerfile = readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');

describe('Dockerfile', () => {
  it('runs with NODE_ENV=production', () => {
    expect(dockerfile).toMatch(/^ENV NODE_ENV=production$/m);
  });
});
