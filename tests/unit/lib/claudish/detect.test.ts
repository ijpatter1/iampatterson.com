/**
 * Claudish translator — detection orchestration + latch (feat/claudish M1).
 *
 * detectClaudish() is the frontend's whole detection API: synchronous,
 * pure, never throws, CCLD when a trained model is loaded, heuristic
 * otherwise. createDetectionLatch() is the UI hysteresis (Schmitt trigger:
 * enter 0.80 / exit 0.55, 24-char minimum, 250ms dwell) so the
 * "Claudish - detected" label doesn't flicker while typing.
 * The committed ccld-weights.json is a version-0 placeholder until M5
 * training lands; the fallback path is the shipped path today.
 */
import {
  createDetectionLatch,
  detectClaudish,
  MIN_DETECT_CHARS,
} from '@/lib/claudish/detect';
import { isCcldAvailable, resetCcldForTests, warmCcld } from '@/lib/claudish/ccld';
import type { DetectionResult } from '@/lib/claudish/types';

const CLAUDISH_TEXT =
  "This isn't just a refactor — it's a fundamental shift in how the pipeline thinks about state.";
const HUMAN_TEXT =
  'Meeting moved to 3pm. Bring the Q3 deck and whatever you have on the churn analysis.';

beforeEach(() => resetCcldForTests());

describe('detectClaudish', () => {
  it('answers from the heuristic while no CCLD model is loaded', () => {
    const r = detectClaudish(CLAUDISH_TEXT);
    expect(r.source).toBe('heuristic');
    expect(r.lang).toBe('en-x-claudish');
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('labels plain human prose as en', () => {
    const r = detectClaudish(HUMAN_TEXT);
    expect(r.lang).toBe('en');
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('returns unknown below the minimum length', () => {
    const r = detectClaudish('short — text');
    expect(r.lang).toBe('unknown');
  });

  it('never throws on empty, emoji-only, or giant input', () => {
    expect(() => detectClaudish('')).not.toThrow();
    expect(() => detectClaudish('🐟🐟🐟')).not.toThrow();
    expect(() => detectClaudish('x'.repeat(200000))).not.toThrow();
    expect(detectClaudish('').lang).toBe('unknown');
  });
});

describe('register-union ensemble (stereotype Claudish must convict with CCLD loaded)', () => {
  it('takes the max of CCLD and the heuristic — the meme register convicts even though the corpus lacks it', async () => {
    await warmCcld();
    const meme = detectClaudish('Let me delve into this for you');
    expect(meme.lang).toBe('en-x-claudish');
    expect(meme.confidence).toBeGreaterThanOrEqual(0.8);
    expect(meme.source).toBe('heuristic'); // the stereotype side won the max
    // The real register convicts regardless of which side wins the max
    // (source reports the winner — diagnostic, not a contract).
    const real = detectClaudish(
      "This isn't just a refactor — it's a fundamental shift in how the pipeline thinks about state."
    );
    expect(real.confidence).toBeGreaterThan(0.8);
    expect(real.lang).toBe('en-x-claudish');
    // And plain human speech convicts on neither side.
    expect(
      detectClaudish('Hang on a minute, let me call my wife and make sure this is ok with her.').lang
    ).toBe('en');
  });
});

describe('ccld swap-in (M5: trained weights are live)', () => {
  it('answers from CCLD after warm-up, same API, heuristic still guards short input', async () => {
    await warmCcld();
    expect(isCcldAvailable()).toBe(true);
    const claudish = detectClaudish(
      "This isn't just a refactor — it's a robust, seamless transformation, underscoring everything."
    );
    expect(claudish.lang).toBe('en-x-claudish');
    expect(claudish.confidence).toBeGreaterThan(0.8);
    // CCLD is loaded and answering (the ensemble max may pick either side).
    expect(isCcldAvailable()).toBe(true);
    const human = detectClaudish('lol yeah that is broken, been meaning to fix it for weeks tbh');
    // Ensemble max: source names the winning side. r7d scores this slang
    // BELOW the heuristic floor (more confidently English), so either
    // source is legitimate — the contract is the verdict, not the winner.
    expect(human.lang).toBe('en');
    // Below the minimum length the orchestration still holds 'unknown'.
    expect(detectClaudish('short — text').lang).toBe('unknown');
  });
});

describe('createDetectionLatch', () => {
  // Injectable scorer gives the tests precise control of the confidence band.
  const scorerFor = (confidence: number) => (_text: string): DetectionResult => ({
    lang: confidence >= 0.5 ? 'en-x-claudish' : 'en',
    confidence,
    source: 'heuristic',
  });
  const LONG = 'x'.repeat(MIN_DETECT_CHARS);

  it('enters detected state at the 0.80 threshold, not below', () => {
    const below = createDetectionLatch({}, scorerFor(0.79));
    expect(below.update(LONG, 0).detected).toBe(false);
    const at = createDetectionLatch({}, scorerFor(0.8));
    expect(at.update(LONG, 0).detected).toBe(true);
  });

  it('always claims a side with a tier — no hedging (user decision)', () => {
    // confident English below 0.30
    expect(createDetectionLatch({}, scorerFor(0.1)).update(LONG, 0)).toMatchObject({
      lang: 'en',
      tier: 'confident',
    });
    // leaning English 0.30-0.50
    expect(createDetectionLatch({}, scorerFor(0.4)).update(LONG, 0)).toMatchObject({
      lang: 'en',
      tier: 'leaning',
    });
    // leaning Claudish 0.50-0.80 (sub-latch)
    expect(createDetectionLatch({}, scorerFor(0.7)).update(LONG, 0)).toMatchObject({
      lang: 'en-x-claudish',
      tier: 'leaning',
      detected: false,
    });
    // confident Claudish at the latch
    expect(createDetectionLatch({}, scorerFor(0.9)).update(LONG, 0)).toMatchObject({
      lang: 'en-x-claudish',
      tier: 'confident',
      detected: true,
    });
  });

  it('confident-English has hysteresis too: enter below 0.30, hold until 0.45', () => {
    let conf = 0.1;
    const latch = createDetectionLatch({}, (t) => scorerFor(conf)(t));
    expect(latch.update(LONG, 0).tier).toBe('confident');
    conf = 0.38; // inside the band: hold confident English
    expect(latch.update(LONG, 1000)).toMatchObject({ lang: 'en', tier: 'confident' });
    conf = 0.46; // past the exit: demote to leaning
    expect(latch.update(LONG, 2000)).toMatchObject({ lang: 'en', tier: 'leaning' });
  });

  it('holds detection through the hysteresis band and exits only at 0.55', () => {
    let conf = 0.9;
    const latch = createDetectionLatch({}, (t) => scorerFor(conf)(t));
    expect(latch.update(LONG, 0).detected).toBe(true);
    conf = 0.6; // inside the band: hold
    expect(latch.update(LONG, 1000).detected).toBe(true);
    conf = 0.55; // at exit: release
    expect(latch.update(LONG, 2000).detected).toBe(false);
  });

  it('holds its previous state below the minimum length instead of flickering', () => {
    const latch = createDetectionLatch({}, scorerFor(0.9));
    expect(latch.update(LONG, 0).detected).toBe(true);
    expect(latch.update('ab', 1000).detected).toBe(true);
  });

  it('refuses to flip again within the dwell window', () => {
    let conf = 0.9;
    const latch = createDetectionLatch({}, (t) => scorerFor(conf)(t));
    expect(latch.update(LONG, 0).detected).toBe(true);
    conf = 0.1;
    expect(latch.update(LONG, 100).detected).toBe(true); // within 250ms dwell: hold
    expect(latch.update(LONG, 400).detected).toBe(false); // past dwell: release
  });

  it('reset() returns to the resting state', () => {
    const latch = createDetectionLatch({}, scorerFor(0.9));
    latch.update(LONG, 0);
    latch.reset();
    expect(latch.update('ab', 1000).detected).toBe(false);
  });
});

describe('zero-family latch cap (round-trip fix, 2026-09-01)', () => {
  // Full "Claudish - detected" requires mechanical register evidence:
  // when NO heuristic family fires (em dash, kill-list vocabulary,
  // contrastive negation, stereotype...), CCLD alone cannot latch —
  // 0.79 keeps such text at most "Leaning Claudish". This is the
  // deterministic floor under the translator's own de-registered
  // output, and it formalizes the shipped contract: full detection is
  // reserved for the loud register and the stereotype door.
  it('caps register-free prose below the latch even when CCLD convicts', async () => {
    await warmCcld();
    // cl2en-style output: plain declaratives, no em dashes, no kill
    // words — raw CCLD scores this shape far above the latch.
    const result = detectClaudish(
      'Your instinct to give me both fixes is right. The first one failed, and that matters. The damage was extensive. The mask fixes it by neutralizing model names, and the new model is promoted.'
    );
    expect(result.confidence).toBeLessThan(0.8);
  });

  it('does not cap when register families fire (loud stays latched)', async () => {
    await warmCcld();
    const result = detectClaudish(
      "This isn't just a refactor — it's a robust, seamless transformation, underscoring everything."
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('leaves the stereotype door open (smoking gun counts as a family)', async () => {
    await warmCcld();
    const result = detectClaudish('Let me delve into this for you');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
