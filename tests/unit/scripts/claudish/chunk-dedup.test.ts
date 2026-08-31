/**
 * Claudish corpus miner — chunking + dedup tests (feat/claudish M3).
 */
import {
  alphaFraction,
  chunkText,
  seededRng,
  splitSentences,
  targetLength,
} from '../../../../scripts/claudish/lib/chunk';
import {
  BoilerplateCounter,
  Deduper,
  hammingDistance,
  simhash,
} from '../../../../scripts/claudish/lib/dedup';

describe('chunking', () => {
  it('splits sentences on terminal punctuation and newlines', () => {
    expect(
      splitSentences('First sentence. Second one! A third?\nFourth on a new line.')
    ).toHaveLength(4);
  });

  it('is deterministic under a seed and respects the length envelope', () => {
    const text = Array.from(
      { length: 200 },
      (_, i) => `Sentence number ${i} carries some ordinary words along.`
    ).join(' ');
    const a = chunkText(text, seededRng(42));
    const b = chunkText(text, seededRng(42));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(3);
    for (const chunk of a) {
      expect(chunk.length).toBeGreaterThanOrEqual(20);
      expect(chunk.length).toBeLessThanOrEqual(1200);
    }
  });

  it('draws short-bucket targets ~15% of the time', () => {
    const rng = seededRng(7);
    const lengths = Array.from({ length: 2000 }, () => targetLength(rng));
    const short = lengths.filter((l) => l <= 80).length / lengths.length;
    expect(short).toBeGreaterThan(0.1);
    expect(short).toBeLessThan(0.35);
  });

  it('drops windows that are mostly non-alphabetic', () => {
    expect(alphaFraction('| 12 | 34 | 56 |')).toBeLessThan(0.4);
    const chunks = chunkText('| 12 | 34 | 56 | 78 | 90 | 11 | 22 | 33 | 44 |', seededRng(1));
    expect(chunks).toEqual([]);
  });
});

describe('dedup', () => {
  it('drops exact and near duplicates, keeps distinct text', () => {
    const deduper = new Deduper();
    const base =
      'The measurement stack routes every event through consent checks before anything ships downstream to the warehouse.';
    expect(deduper.add(base)).toBe(true);
    expect(deduper.add(base)).toBe(false); // exact
    expect(deduper.add(base.replace('warehouse', 'warehouze'))).toBe(false); // near
    expect(
      deduper.add('A completely different sentence about soup and bread and salt levels.')
    ).toBe(true);
  });

  it('simhash puts similar text nearby and different text far apart', () => {
    const a = simhash('the quick brown fox jumps over the lazy dog near the river bank today');
    const b = simhash('the quick brown fox jumps over the lazy dog near the river bank todaz');
    const c = simhash('completely unrelated content about quarterly budget forecasting models');
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(3);
    expect(hammingDistance(a, c)).toBeGreaterThan(10);
  });

  it('flags chunks seen across more than 20 sessions as boilerplate', () => {
    const counter = new BoilerplateCounter();
    const opener = 'Let me start by understanding the environment.';
    for (let i = 0; i < 21; i++) counter.observe(opener, `session-${i}`);
    expect(counter.isBoilerplate(opener)).toBe(true);
    counter.observe('rare sentence', 'session-1');
    expect(counter.isBoilerplate('rare sentence')).toBe(false);
    // Same session repeating does not inflate the count.
    const repeat = 'Repeated within one session only.';
    for (let i = 0; i < 30; i++) counter.observe(repeat, 'session-x');
    expect(counter.isBoilerplate(repeat)).toBe(false);
  });
});
