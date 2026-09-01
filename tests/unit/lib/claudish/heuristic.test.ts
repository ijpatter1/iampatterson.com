/**
 * Claudish translator — regex heuristic detector (feat/claudish M1).
 *
 * The bootstrap detector until CCLD trains, and the permanent fallback.
 * Contract under test:
 *  - clear Claudish scores high; most of it confidently (≥ 0.8, the latch
 *    enter threshold);
 *  - plain human prose stays below 0.5;
 *  - single-family traps (em dashes alone, formality alone) are NEVER
 *    confident — the two-independent-families rule caps them below 0.8;
 *  - aggregate precision/recall ≥ 0.85 at the 0.5 boundary on the fixture;
 *  - pure and deterministic, never throws.
 */
import { scoreClaudish } from '@/lib/claudish/heuristic';
import {
  CLAUDISH_CASES,
  HUMAN_CASES,
  TRAP_CASES,
} from './heuristic.fixtures';

const CONFIDENT = 0.8; // latch enter threshold

describe('scoreClaudish — per-case bands', () => {
  it.each(CLAUDISH_CASES.map((t) => [t.slice(0, 60), t]))(
    'scores Claudish ≥ 0.55: %s…',
    (_label, text) => {
      expect(scoreClaudish(text).score).toBeGreaterThanOrEqual(0.55);
    }
  );

  it('confidently detects at least 15 of the 20 Claudish cases', () => {
    const confident = CLAUDISH_CASES.filter(
      (t) => scoreClaudish(t).score >= CONFIDENT
    );
    expect(confident.length).toBeGreaterThanOrEqual(15);
  });

  it.each(HUMAN_CASES.map((t) => [t.slice(0, 60), t]))(
    'scores plain human < 0.5: %s…',
    (_label, text) => {
      expect(scoreClaudish(text).score).toBeLessThan(0.5);
    }
  );

  it.each(TRAP_CASES.map((t) => [t.slice(0, 60), t]))(
    'never convicts a single-family trap: %s…',
    (_label, text) => {
      const r = scoreClaudish(text);
      expect(r.score).toBeLessThan(CONFIDENT);
    }
  );
});

describe('scoreClaudish — aggregate quality on the fixture', () => {
  it('achieves precision and recall ≥ 0.85 at the 0.5 boundary', () => {
    const negatives = [...HUMAN_CASES, ...TRAP_CASES];
    const tp = CLAUDISH_CASES.filter((t) => scoreClaudish(t).score >= 0.5).length;
    const fp = negatives.filter((t) => scoreClaudish(t).score >= 0.5).length;
    const fn = CLAUDISH_CASES.length - tp;
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    expect(precision).toBeGreaterThanOrEqual(0.85);
    expect(recall).toBeGreaterThanOrEqual(0.85);
  });
});

describe('scoreClaudish — stereotype smoking guns', () => {
  // The corpus barely contains the meme words (delve x2 in 33MB — the
  // author's skills ban them), so CCLD cannot learn them. The heuristic
  // owns the stereotype register: first-person meme constructions
  // convict on their own.
  it.each([
    'Let me delve into this for you',
    "I'll delve into the details and get back to you shortly.",
    "Let's delve deeper into what makes this approach robust.",
    'As an AI language model, I cannot browse the internet.',
    'I hope this email finds you well.',
    'This forms a rich tapestry of interconnected insights.',
  ])('convicts first-person/meme stereotype: %s', (text) => {
    expect(scoreClaudish(text).score).toBeGreaterThanOrEqual(0.8);
  });

  it.each([
    'The book delves into medieval trade routes across the Baltic.',
    'Her latest documentary delves into the history of the mill towns.',
    'She wove a tapestry for the museum exhibition last spring.',
  ])('third-person/literal human usage stays unconvicted: %s', (text) => {
    expect(scoreClaudish(text).score).toBeLessThan(0.8);
  });
});

describe('scoreClaudish — robustness', () => {
  it('is deterministic', () => {
    const text = CLAUDISH_CASES[0];
    expect(scoreClaudish(text).score).toBe(scoreClaudish(text).score);
  });

  it('returns 0 for empty and whitespace-only input without throwing', () => {
    expect(scoreClaudish('').score).toBe(0);
    expect(scoreClaudish('  \n ').score).toBe(0);
  });

  it('handles emoji-only and giant inputs without throwing', () => {
    expect(() => scoreClaudish('🐟🐟🐟')).not.toThrow();
    expect(() => scoreClaudish('word '.repeat(20000))).not.toThrow();
  });

  it('reports which signal families fired, for the em-dash counter UI and debugging', () => {
    const r = scoreClaudish(CLAUDISH_CASES[0]);
    expect(r.activeFamilies).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(r.signals)).toBe(true);
    expect(r.signals.length).toBeGreaterThan(0);
  });

  it('em dashes alone activate only one family', () => {
    const r = scoreClaudish(TRAP_CASES[0]);
    expect(r.activeFamilies).toBeLessThan(2);
  });
});
