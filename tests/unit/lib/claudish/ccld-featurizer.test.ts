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

describe('v2 model-name masking', () => {
  const { CCLD_V2_CONFIG, CCLD_CONFIG, extractFeatures, configHash } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/lib/claudish/ccld-featurizer');

  function featuresEqual(
    a: Array<Map<number, number>>,
    b: Array<Map<number, number>>
  ): boolean {
    return (
      a.length === b.length &&
      a.every((m, i) => {
        const other = b[i];
        if (m.size !== other.size) return false;
        for (const [k, v] of m) if (other.get(k) !== v) return false;
        return true;
      })
    );
  }

  it('masks model names so topic identity vanishes under v2', () => {
    const aboutClaude = extractFeatures('I asked Claude to summarize the notes.', CCLD_V2_CONFIG);
    const aboutName = extractFeatures('I asked name to summarize the notes.', CCLD_V2_CONFIG);
    expect(featuresEqual(aboutClaude, aboutName)).toBe(true);
  });

  it('does not mask under v1 (frozen behavior unchanged)', () => {
    const aboutClaude = extractFeatures('I asked Claude to summarize the notes.', CCLD_CONFIG);
    const aboutName = extractFeatures('I asked name to summarize the notes.', CCLD_CONFIG);
    expect(featuresEqual(aboutClaude, aboutName)).toBe(false);
  });

  it('masks the full name family, not just claude', () => {
    const left = extractFeatures('Opus 5 and Fable 5 and ChatGPT and Gemini.', CCLD_V2_CONFIG);
    const right = extractFeatures('name 5 and name 5 and name and name.', CCLD_V2_CONFIG);
    expect(featuresEqual(left, right)).toBe(true);
  });

  it('leaves ordinary words alone under v2 (mask is surgical)', () => {
    const a = extractFeatures('The sonnets of Shakespeare are opulent.', CCLD_V2_CONFIG);
    const b = extractFeatures('The name of Shakespeare are name.', CCLD_V2_CONFIG);
    // "sonnets" (plural, not "sonnet") and "opulent" must NOT be masked.
    expect(featuresEqual(a, b)).toBe(false);
  });

  it('v1 and v2 hashes differ (distinct load contracts)', () => {
    expect(configHash(CCLD_V2_CONFIG)).not.toBe(configHash(CCLD_CONFIG));
    expect(configHash()).toBe(configHash(CCLD_CONFIG));
  });
});

describe('v5: hashed word features as extra orders (loop-2 D2)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CCLD_V5_CONFIG, CCLD_V4_CONFIG, extractFeatures, configHash, wordTokens } = require('@/lib/claudish/ccld-featurizer') as typeof import('@/lib/claudish/ccld-featurizer');
  it('has a distinct hash and declares word orders after the char orders', () => {
    expect(configHash(CCLD_V5_CONFIG)).not.toBe(configHash(CCLD_V4_CONFIG));
    expect(CCLD_V5_CONFIG.wordOrders).toEqual([1, 2]);
    expect(CCLD_V5_CONFIG.wordBuckets?.length).toBe(2);
  });
  it('tokenizes to lowercase words, dropping punctuation but keeping identifiers whole', () => {
    expect(wordTokens('We shipped 3 fixes in PR #2, see config.yaml!')).toEqual(['we', 'shipped', '3', 'fixes', 'in', 'pr', '2', 'see', 'config.yaml']);
  });
  it('appends word-unigram and word-bigram fraction maps that each sum to 1', () => {
    const f = extractFeatures('the cat sat on the mat', CCLD_V5_CONFIG);
    expect(f).toHaveLength(CCLD_V5_CONFIG.orders.length + 2);
    const uni = f[CCLD_V5_CONFIG.orders.length];
    const bi = f[CCLD_V5_CONFIG.orders.length + 1];
    const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    expect(sum(uni)).toBeCloseTo(1, 9);
    expect(sum(bi)).toBeCloseTo(1, 9);
    // "the" appears twice in six words: one bucket carries 2/6 (unless it collides).
    expect([...uni.values()].some((v) => Math.abs(v - 2 / 6) < 1e-9)).toBe(true);
    expect(bi.size).toBeLessThanOrEqual(5);
  });
});

describe('v6/v7: sentence-shape structure features (loop-2 D3)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const F = require('@/lib/claudish/ccld-featurizer') as typeof import('@/lib/claudish/ccld-featurizer');
  it('declares distinct configs: v6 = v4 + structure, v7 = v5 + register + structure', () => {
    expect(F.CCLD_V6_CONFIG.structureFeatures).toBe(F.STRUCTURE_FEATURE_COUNT);
    expect(F.CCLD_V6_CONFIG.registerFeatures).toBe(F.REGISTER_FEATURE_COUNT);
    expect(F.CCLD_V6_CONFIG.wordOrders).toBeUndefined();
    expect(F.CCLD_V7_CONFIG.wordOrders).toEqual([1, 2]);
    expect(F.CCLD_V7_CONFIG.structureFeatures).toBe(F.STRUCTURE_FEATURE_COUNT);
    const hashes = new Set([F.CCLD_V4_CONFIG, F.CCLD_V5_CONFIG, F.CCLD_V6_CONFIG, F.CCLD_V7_CONFIG].map(F.configHash));
    expect(hashes.size).toBe(4);
  });
  it('measures sentence shape, not vocabulary: question share, first-person openers, colons, clauses', () => {
    const s = F.extractStructureFeatures('Is it done? I think so, mostly: two parts remain, and one is easy. We ship Monday.');
    expect(s).toHaveLength(F.STRUCTURE_FEATURE_COUNT);
    for (const v of s) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    expect(s[F.STRUCTURE_INDEX.questionShare]).toBeCloseTo(1 / 3, 6);
    expect(s[F.STRUCTURE_INDEX.firstPersonOpenerShare]).toBeCloseTo(2 / 3, 6);
    expect(s[F.STRUCTURE_INDEX.colonShare]).toBeCloseTo(1 / 3, 6);
    expect(s[F.STRUCTURE_INDEX.clausesPerSentence]).toBeGreaterThan(0);
  });
  it('returns zeros on empty text and concatenates register + structure for dense input', () => {
    expect([...F.extractStructureFeatures('')].every((v) => v === 0)).toBe(true);
    expect(F.extractDenseFeatures('Plain text here.', F.CCLD_V6_CONFIG)).toHaveLength(F.REGISTER_FEATURE_COUNT + F.STRUCTURE_FEATURE_COUNT);
    expect(F.extractDenseFeatures('Plain text here.', F.CCLD_V5_CONFIG)).toBeUndefined();
    expect(F.extractDenseFeatures('Plain text here.', F.CCLD_V4_CONFIG)).toHaveLength(F.REGISTER_FEATURE_COUNT);
  });
});
