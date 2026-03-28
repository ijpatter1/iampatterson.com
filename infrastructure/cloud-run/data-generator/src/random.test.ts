import { SeededRandom } from './random';

describe('SeededRandom', () => {
  describe('reproducibility', () => {
    it('produces the same sequence for the same seed', () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(42);
      const seq1 = Array.from({ length: 20 }, () => rng1.next());
      const seq2 = Array.from({ length: 20 }, () => rng2.next());
      expect(seq1).toEqual(seq2);
    });

    it('produces different sequences for different seeds', () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(99);
      const seq1 = Array.from({ length: 10 }, () => rng1.next());
      const seq2 = Array.from({ length: 10 }, () => rng2.next());
      expect(seq1).not.toEqual(seq2);
    });
  });

  describe('next()', () => {
    it('returns values in [0, 1)', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 1000; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('int()', () => {
    it('returns integers within the specified range (inclusive)', () => {
      const rng = new SeededRandom(42);
      for (let i = 0; i < 500; i++) {
        const val = rng.int(5, 10);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThanOrEqual(10);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it('returns min when min === max', () => {
      const rng = new SeededRandom(42);
      expect(rng.int(7, 7)).toBe(7);
    });
  });

  describe('chance()', () => {
    it('returns true roughly proportional to probability', () => {
      const rng = new SeededRandom(42);
      const n = 10000;
      let trues = 0;
      for (let i = 0; i < n; i++) {
        if (rng.chance(0.3)) trues++;
      }
      // Should be roughly 30% with some tolerance
      expect(trues / n).toBeGreaterThan(0.25);
      expect(trues / n).toBeLessThan(0.35);
    });

    it('always returns false for probability 0', () => {
      const rng = new SeededRandom(42);
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(0)).toBe(false);
      }
    });
  });

  describe('pick()', () => {
    it('picks elements from the array', () => {
      const rng = new SeededRandom(42);
      const items = ['a', 'b', 'c', 'd'];
      const picked = new Set<string>();
      for (let i = 0; i < 100; i++) {
        picked.add(rng.pick(items));
      }
      // Over 100 picks, should hit all 4 items
      expect(picked.size).toBe(4);
    });
  });

  describe('weighted()', () => {
    it('picks items proportional to their weights', () => {
      const rng = new SeededRandom(42);
      const items: Array<readonly [string, number]> = [
        ['rare', 1],
        ['common', 9],
      ];
      const counts: Record<string, number> = { rare: 0, common: 0 };
      const n = 10000;
      for (let i = 0; i < n; i++) {
        counts[rng.weighted(items)]++;
      }
      // 'common' should be ~90%, 'rare' ~10%
      expect(counts['common'] / n).toBeGreaterThan(0.85);
      expect(counts['rare'] / n).toBeLessThan(0.15);
    });

    it('returns the only item when weight is sole', () => {
      const rng = new SeededRandom(42);
      const result = rng.weighted([['only', 1]] as const);
      expect(result).toBe('only');
    });
  });

  describe('gaussian()', () => {
    it('produces values centered around the mean', () => {
      const rng = new SeededRandom(42);
      const mean = 100;
      const stddev = 10;
      const n = 10000;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += rng.gaussian(mean, stddev);
      }
      const actualMean = sum / n;
      expect(actualMean).toBeGreaterThan(98);
      expect(actualMean).toBeLessThan(102);
    });
  });

  describe('poisson()', () => {
    it('produces non-negative integers', () => {
      const rng = new SeededRandom(42);
      for (let i = 0; i < 500; i++) {
        const val = rng.poisson(5);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it('has mean close to lambda', () => {
      const rng = new SeededRandom(42);
      const lambda = 7;
      const n = 10000;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += rng.poisson(lambda);
      }
      const actualMean = sum / n;
      expect(actualMean).toBeGreaterThan(6.5);
      expect(actualMean).toBeLessThan(7.5);
    });

    it('returns 0 for lambda 0', () => {
      const rng = new SeededRandom(42);
      expect(rng.poisson(0)).toBe(0);
    });
  });
});
