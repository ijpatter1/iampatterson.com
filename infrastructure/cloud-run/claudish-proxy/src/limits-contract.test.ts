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

import { loopBudgetFor } from './cl2en-loop';
import { GEMINI_PRICES, INPUT_CAP, MAX_TOKENS, PRICES, RESERVATION_USD } from './config';
import { buildSystem } from './prompts';

/**
 * Chars-per-token planning figure, measured on Haiku 4.5 billing (drift
 * ~5%). It still plans the Gemini loop, whose tokenizer 20.1 leaves alone.
 */
const CHARS_PER_TOKEN = 3.8;
/**
 * Claude lanes since 20.1: Haiku 5.5's tokenizer turns the same text into
 * about 30% more tokens than Haiku 4.5's (Anthropic's migration notes; the
 * exact rise depends on the text). A planning figure until the golden run
 * bills the prefix: re-measure it there and repin this.
 */
const CLAUDE_CHARS_PER_TOKEN = CHARS_PER_TOKEN / 1.3;
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
    const worstOutputTokens = Math.ceil((INPUT_CAP * EN2CL_MAX_EXPANSION) / CLAUDE_CHARS_PER_TOKEN);
    expect(MAX_TOKENS.en2cl).toBeGreaterThanOrEqual(worstOutputTokens);
  });

  it('cl2en max_tokens holds an uncompressed cap-length input', () => {
    // English compresses, but a faithful translation of dense plain
    // input can run ~1:1; the cap must not truncate that case.
    // The Claude ladder serves cl2en when the loop falls through, so the
    // Claude figure applies.
    const worstOutputTokens = Math.ceil(INPUT_CAP / CLAUDE_CHARS_PER_TOKEN);
    expect(MAX_TOKENS.cl2en).toBeGreaterThanOrEqual(worstOutputTokens);
  });

  it('RESERVATION_USD covers the derived worst case (en2cl, cold prefix = cache write)', () => {
    expect(RESERVATION_USD).toBeGreaterThanOrEqual(en2clWorstUsd());
  });

  it('RESERVATION_USD covers one cl2en loop attempt at its worst (review batch 2: each attempt holds its own)', () => {
    expect(RESERVATION_USD).toBeGreaterThanOrEqual(cl2enLoopAttemptWorstUsd());
  });

  it('RESERVATION_USD tracks the binding worst case instead of a stale one (20.1)', () => {
    // A reservation far above every real worst case only shrinks how many
    // requests fit under the per-instance cap at once. Haiku 5.5 cut the
    // en2cl worst case by ~7x and left the old $0.022 almost 3x above the
    // binding bound (now the Gemini loop attempt); this pin makes the next
    // price change re-derive the figure rather than carry it forward.
    const binding = Math.max(en2clWorstUsd(), cl2enLoopAttemptWorstUsd());
    expect(RESERVATION_USD).toBeLessThanOrEqual(binding * 1.25);
  });
});

/**
 * en2cl at the cap on a Claude lane. Since Stage 2 the prefix crosses the
 * cache minimum, so the worst case is a cache WRITE of the whole prefix
 * (1.25x input price), not a plain uncached read.
 */
function en2clWorstUsd(): number {
  const prefixTokens = Math.ceil(buildSystem('en2cl').length / CLAUDE_CHARS_PER_TOKEN);
  const inputTokens = Math.ceil(INPUT_CAP / CLAUDE_CHARS_PER_TOKEN);
  // Billed at the cap, not the expected length: max_tokens is the ceiling.
  const outputTokens = MAX_TOKENS.en2cl;
  return (
    (prefixTokens * PRICES.cacheWritePerMTok +
      inputTokens * PRICES.inputPerMTok +
      outputTokens * PRICES.outputPerMTok) /
    1_000_000
  );
}

/**
 * The last cl2en loop attempt re-sends every prior assistant turn (each up
 * to the output cap) plus a feedback turn, at Gemini prices. Each attempt
 * takes a reservation of its own, so this per-attempt figure is the bound.
 */
function cl2enLoopAttemptWorstUsd(): number {
  const attempts = loopBudgetFor(INPUT_CAP).maxAttempts;
  const systemTokens = Math.ceil(buildSystem('cl2en').length / CHARS_PER_TOKEN);
  const inputTokens = Math.ceil(INPUT_CAP / CHARS_PER_TOKEN) + 60;
  const priorTurns = (attempts - 1) * (MAX_TOKENS.cl2en + 300);
  return (
    ((systemTokens + inputTokens + priorTurns) * GEMINI_PRICES.inputPerMTok +
      MAX_TOKENS.cl2en * GEMINI_PRICES.outputPerMTok) /
    1_000_000
  );
}
