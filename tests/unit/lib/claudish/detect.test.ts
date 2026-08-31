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

describe('ccld swap-in (M5: trained weights are live)', () => {
  it('answers from CCLD after warm-up, same API, heuristic still guards short input', async () => {
    await warmCcld();
    expect(isCcldAvailable()).toBe(true);
    const claudish = detectClaudish(
      "This isn't just a refactor — it's a robust, seamless transformation, underscoring everything."
    );
    expect(claudish.source).toBe('ccld');
    expect(claudish.lang).toBe('en-x-claudish');
    expect(claudish.confidence).toBeGreaterThan(0.8);
    const human = detectClaudish('lol yeah that is broken, been meaning to fix it for weeks tbh');
    expect(human.source).toBe('ccld');
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
