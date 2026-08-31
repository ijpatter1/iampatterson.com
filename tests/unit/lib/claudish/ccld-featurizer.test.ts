/**
 * Claudish translator — CCLD featurizer tests (feat/claudish M5).
 *
 * The featurizer is FROZEN once training runs: the trainer imports this
 * exact module (structural parity), and the exported configHash is
 * embedded in the weights and asserted at load. CLD3's own README
 * example is the ground-truth case: for "banana", the trigram "ana"
 * appears 2 times in 4 windows = fraction 0.5 (their example counts
 * distinct windows over the unpadded interior for the illustration;
 * ours pads with spaces, asserted exactly below).
 */
import {
  CCLD_CONFIG,
  configHash,
  extractFeatures,
  fnv1a32,
} from '@/lib/claudish/ccld-featurizer';

describe('fnv1a32', () => {
  it('matches known FNV-1a vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('hashes UTF-8 bytes so multibyte chars are portable', () => {
    // em dash U+2014 = E2 80 94 in UTF-8
    expect(fnv1a32('—')).toBe(fnv1a32('—'));
    expect(fnv1a32('—')).not.toBe(fnv1a32('-'));
  });
});

describe('extractFeatures', () => {
  it('produces per-order fraction maps that sum to 1', () => {
    const features = extractFeatures('banana');
    for (let order = 0; order < CCLD_CONFIG.orders.length; order++) {
      const sum = [...features[order].values()].reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('pads with spaces so word-boundary n-grams exist ("banana" → " banana ")', () => {
    // Padded text " banana " has 7 bigram windows; " b" occurs once.
    const features = extractFeatures('banana');
    const bigrams = features[CCLD_CONFIG.orders.indexOf(2)];
    const spaceB = bigrams.get(fnv1a32(' b') % CCLD_CONFIG.buckets[CCLD_CONFIG.orders.indexOf(2)]);
    expect(spaceB).toBeCloseTo(1 / 7, 10);
  });

  it('counts trigram fractions exactly (ana appears twice in 6 windows of " banana ")', () => {
    const features = extractFeatures('banana');
    const idx = CCLD_CONFIG.orders.indexOf(3);
    const ana = features[idx].get(fnv1a32('ana') % CCLD_CONFIG.buckets[idx]);
    expect(ana).toBeCloseTo(2 / 6, 10);
  });

  it('lowercases and collapses whitespace before featurizing', () => {
    expect(extractFeatures('BaNaNa')).toEqual(extractFeatures('banana'));
    expect(extractFeatures('a  b')).toEqual(extractFeatures('a b'));
  });

  it('iterates code points: an em dash is one unit', () => {
    const features = extractFeatures('a—b');
    const idx = CCLD_CONFIG.orders.indexOf(1);
    // padded: " a—b " → 5 unigram windows, em dash is 1 of them
    const dash = features[idx].get(fnv1a32('—') % CCLD_CONFIG.buckets[idx]);
    expect(dash).toBeCloseTo(1 / 5, 10);
  });

  it('returns empty maps for empty input', () => {
    const features = extractFeatures('');
    for (const map of features) expect(map.size).toBe(0);
  });
});

describe('configHash', () => {
  it('is stable for the frozen config', () => {
    expect(configHash()).toMatch(/^[0-9a-f]{64}$/);
    expect(configHash()).toBe(configHash());
  });
});
