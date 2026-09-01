/**
 * claudish-proxy — normalization + bounded translation cache.
 *
 * normalizeInput mirrors src/lib/claudish/normalize.ts on the frontend
 * byte-for-byte (NFC, per-line trailing trim, space/tab collapse, 3+
 * newlines to paragraph break, case PRESERVED) so client and server
 * caches agree on the same preimage. The key folds in direction, prompt
 * version, and model ID — a prompt edit or model bump invalidates every
 * entry for free. Only complete end_turn successes are cached.
 */
import { createHash } from 'node:crypto';

import type { Direction } from './config';

export function normalizeInput(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cacheKey(
  direction: Direction,
  promptVersion: string,
  modelId: string,
  normalized: string
): string {
  return createHash('sha256')
    .update(`${direction} ${promptVersion} ${modelId} ${normalized}`)
    .digest('hex')
    .slice(0, 32);
}

interface Entry {
  text: string;
  expiresAt: number;
}

export class TranslationCache {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly maxEntries = 500,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly maxValueBytes = 8 * 1024
  ) {}

  get(key: string, now: number = Date.now()): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    // LRU recency: re-insert on read.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.text;
  }

  /** Store a COMPLETE translation. Oversized values are skipped, not truncated. */
  set(key: string, text: string, now: number = Date.now()): void {
    if (Buffer.byteLength(text, 'utf8') > this.maxValueBytes) return;
    this.entries.delete(key);
    this.entries.set(key, { text, expiresAt: now + this.ttlMs });
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Quality gate on cache writes. An output that merely echoes the input
 * (the temp-0 copy attractor on identifier-dense text, observed live
 * 2026-09-01) or a cl2en output still carrying em dashes violates the
 * translation contract — serving it once is a model bug; replaying it
 * from cache for 24h would make the bug permanent for that input.
 */
export function cacheableTranslation(
  direction: 'en2cl' | 'cl2en',
  normalizedInput: string,
  output: string
): boolean {
  // Echo detection is dash-insensitive: the stream smoother rewrites em
  // dashes to commas, so a model echo arrives here as input-with-commas
  // — still an echo, still never worth pinning.
  const dashless = (t: string) => t.replace(/ \u2014 /g, ', ').replace(/\u2014/g, ',');
  if (normalizeInput(dashless(output)) === normalizeInput(dashless(normalizedInput))) return false;
  if (direction === 'cl2en' && output.includes('\u2014')) return false;
  return true;
}
