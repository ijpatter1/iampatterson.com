/**
 * Seeded pseudo-random number generator for reproducible data generation.
 *
 * Uses a simple mulberry32 algorithm — good enough for synthetic data,
 * not for cryptography.
 */

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns true with the given probability (0–1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick a random element from an array. */
  pick<T>(array: readonly T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  /** Pick from a weighted distribution. Items are [value, weight] pairs. */
  weighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
    const totalWeight = items.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * totalWeight;
    for (const [value, weight] of items) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    // Fallback (shouldn't reach here due to float precision)
    return items[items.length - 1][0];
  }

  /** Gaussian-distributed random number (Box-Muller). */
  gaussian(mean: number, stddev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  /** Poisson-distributed random integer. */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L);
    return k - 1;
  }
}
