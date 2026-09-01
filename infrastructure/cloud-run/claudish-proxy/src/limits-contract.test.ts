/**
 * Limits contract pins (Stage 1 of the 2026-09-01 bundle).
 *
 * The 3,000-character cap is six coupled numbers, not one. These pins
 * make the couplings mechanical: the server cap equals the client cap
 * (read from the repo, dev/CI only), the output token caps can hold a
 * fully expanded cap-length translation (the pre-bundle 1024 could not
 * even hold 1,200-char expansions), and the per-request budget
 * reservation covers the derived worst case.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { INPUT_CAP, MAX_TOKENS, PRICES, RESERVATION_USD } from './config';
import { buildSystem } from './prompts';

/** Chars-per-token planning figure; measured drift vs billing is ~5%. */
const CHARS_PER_TOKEN = 3.8;
/** en2cl growth ceiling from assertions.ts: max(3.5x, +520 chars). */
const EN2CL_MAX_EXPANSION = 3.5;

describe('cap couplings', () => {
  it('server INPUT_CAP equals the client INPUT_CAP', () => {
    const limits = readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'src', 'lib', 'claudish', 'limits.ts'),
      'utf8',
    );
    const match = /export const INPUT_CAP = (\d+);/.exec(limits);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(INPUT_CAP);
    expect(INPUT_CAP).toBe(3000);
  });

  it('en2cl max_tokens holds a fully expanded cap-length input', () => {
    const worstOutputTokens = Math.ceil((INPUT_CAP * EN2CL_MAX_EXPANSION) / CHARS_PER_TOKEN);
    expect(MAX_TOKENS.en2cl).toBeGreaterThanOrEqual(worstOutputTokens);
  });

  it('cl2en max_tokens holds an uncompressed cap-length input', () => {
    // English compresses, but a faithful translation of dense plain
    // input can run ~1:1; the cap must not truncate that case.
    const worstOutputTokens = Math.ceil(INPUT_CAP / CHARS_PER_TOKEN);
    expect(MAX_TOKENS.cl2en).toBeGreaterThanOrEqual(worstOutputTokens);
  });

  it('RESERVATION_USD covers the derived worst case (en2cl, cold prefix = cache write)', () => {
    // Since Stage 2 the prefix crosses the cache minimum, so the worst
    // case is a cache WRITE of the whole prefix (1.25x input price), not
    // a plain uncached read.
    const prefixTokens = Math.ceil(buildSystem('en2cl').length / CHARS_PER_TOKEN);
    const inputTokens = Math.ceil(INPUT_CAP / CHARS_PER_TOKEN);
    const outputTokens = Math.ceil((INPUT_CAP * EN2CL_MAX_EXPANSION) / CHARS_PER_TOKEN);
    const worstUsd =
      (prefixTokens * PRICES.cacheWritePerMTok +
        inputTokens * PRICES.inputPerMTok +
        outputTokens * PRICES.outputPerMTok) /
      1_000_000;
    expect(RESERVATION_USD).toBeGreaterThanOrEqual(worstUsd);
  });
});
