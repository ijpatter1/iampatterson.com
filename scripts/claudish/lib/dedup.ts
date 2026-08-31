/**
 * Claudish corpus miner — three-stage dedup.
 *
 * Transcripts repeat boilerplate massively ("Let me ..." / "I'll ..."
 * openers dominate raw counts). Stages: exact SHA-1; SimHash (64-bit,
 * char 4-gram shingles, Hamming distance ≤ 3) for near-duplicates; and
 * boilerplate suppression — any normalized chunk seen in more than 20
 * distinct sessions is dropped entirely. Per-session and per-project
 * caps stop the two giant projects from owning the model.
 */
import { createHash } from 'node:crypto';

export function exactKey(normalized: string): string {
  return createHash('sha1').update(normalized).digest('hex');
}

/** 64-bit SimHash over character 4-gram shingles, as a BigInt. */
export function simhash(text: string): bigint {
  const weights = new Array<number>(64).fill(0);
  const lower = text.toLowerCase();
  for (let i = 0; i <= lower.length - 4; i++) {
    const shingle = lower.slice(i, i + 4);
    // FNV-1a 64-bit
    let hash = 0xcbf29ce484222325n;
    for (let j = 0; j < shingle.length; j++) {
      hash ^= BigInt(shingle.charCodeAt(j));
      hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    for (let bit = 0; bit < 64; bit++) {
      weights[bit] += (hash >> BigInt(bit)) & 1n ? 1 : -1;
    }
  }
  let out = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (weights[bit] > 0) out |= 1n << BigInt(bit);
  }
  return out;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

const BANDS = 4; // 16 bits each: near-duplicates share at least one band

function bandKeys(hash: bigint): string[] {
  const keys: string[] = [];
  for (let band = 0; band < BANDS; band++) {
    const bits = (hash >> BigInt(band * 16)) & 0xffffn;
    keys.push(`${band}:${bits.toString(16)}`);
  }
  return keys;
}

export class Deduper {
  private seenExact = new Set<string>();
  private bandIndex = new Map<string, bigint[]>();

  constructor(private readonly maxHamming = 3) {}

  /** Returns true when the chunk is NEW (kept); false when a duplicate. */
  add(normalized: string): boolean {
    const key = exactKey(normalized);
    if (this.seenExact.has(key)) return false;
    const hash = simhash(normalized);
    for (const band of bandKeys(hash)) {
      for (const candidate of this.bandIndex.get(band) ?? []) {
        if (hammingDistance(candidate, hash) <= this.maxHamming) return false;
      }
    }
    this.seenExact.add(key);
    for (const band of bandKeys(hash)) {
      const bucket = this.bandIndex.get(band);
      if (bucket) bucket.push(hash);
      else this.bandIndex.set(band, [hash]);
    }
    return true;
  }
}

/** Tracks how many distinct sessions produced each normalized chunk. */
export class BoilerplateCounter {
  private counts = new Map<string, Set<string>>();

  observe(normalized: string, sessionId: string): void {
    const key = exactKey(normalized.toLowerCase());
    const set = this.counts.get(key);
    if (set) set.add(sessionId);
    else this.counts.set(key, new Set([sessionId]));
  }

  isBoilerplate(normalized: string, threshold = 20): boolean {
    return (this.counts.get(exactKey(normalized.toLowerCase()))?.size ?? 0) > threshold;
  }
}
