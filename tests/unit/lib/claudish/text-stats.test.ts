/**
 * Claudish translator — text statistics (feat/claudish M1).
 *
 * countChars feeds the "412 / 3,000" counter and must use the same unit
 * as textarea maxLength and the server cap (UTF-16 code units), or the
 * three disagree on emoji-laden input. countEmDashes feeds the counter's
 * "· 9 em dashes" tail and the detection heuristic. normalizeForDetection
 * is shared verbatim with the CCLD featurizer — changing it after training
 * invalidates the model (guarded separately by the featurizer configHash).
 */
import {
  countChars,
  countEmDashes,
  normalizeForDetection,
} from '@/lib/claudish/text-stats';

describe('countEmDashes', () => {
  it('counts U+2014 em dashes', () => {
    expect(countEmDashes('a — b — c')).toBe(2);
  });

  it('does not count hyphens or en dashes', () => {
    expect(countEmDashes('a - b – c')).toBe(0);
  });

  it('counts unspaced em dashes', () => {
    expect(countEmDashes('word—word')).toBe(1);
  });

  it('returns 0 for empty input', () => {
    expect(countEmDashes('')).toBe(0);
  });
});

describe('countChars', () => {
  it('counts UTF-16 code units to match maxLength and the server cap', () => {
    expect(countChars('hello')).toBe(5);
    // Astral emoji is a surrogate pair: 2 units, matching what maxLength
    // would enforce. Deliberate — the counter must agree with the cap.
    expect(countChars('🐟')).toBe(2);
  });

  it('counts an em dash as one unit', () => {
    expect(countChars('—')).toBe(1);
  });
});

describe('normalizeForDetection', () => {
  it('lowercases, collapses whitespace runs (incl. newlines), and trims', () => {
    expect(normalizeForDetection('  It\'s   Not\n\na gap.  ')).toBe("it's not a gap.");
  });

  it('applies Unicode NFC so composed and decomposed forms detect identically', () => {
    // 'cafe' + combining acute (NFD) must normalize to the composed form (NFC)
    expect(normalizeForDetection('cafe\u0301')).toBe('caf\u00e9');
  });

  it('preserves em dashes — they are the signal, not noise', () => {
    expect(normalizeForDetection('A — B')).toBe('a — b');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeForDetection(' \n\t ')).toBe('');
  });
});
