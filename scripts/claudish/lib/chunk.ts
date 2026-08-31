/**
 * Claudish corpus miner — chunking to match the runtime distribution.
 *
 * The detector's runtime input is LinkedIn-post-sized, but detection
 * fires from the first keystroke — short inputs are the COMMON case.
 * Windows target lengths drawn log-uniformly from 40 to 1,200 chars,
 * plus an explicit 15% short bucket (20-80 chars). Deterministic via a
 * seeded PRNG so training is reproducible. Windows under 40% alphabetic
 * (tables, tree output surviving scrub) are dropped.
 */

export interface Rng {
  (): number; // [0, 1)
}

/** Deterministic LCG for reproducible chunking/splits. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function splitSentences(text: string): string[] {
  // Sentence-ish boundaries: terminal punctuation + space + capital,
  // or hard newlines. Deliberately simple — over-splitting is harmless
  // (windows re-join), under-splitting just makes longer sentences.
  return text
    .split(/(?<=[.!?…])\s+(?=[A-Z"“'(])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function alphaFraction(text: string): number {
  if (text.length === 0) return 0;
  const letters = text.match(/[A-Za-z]/g)?.length ?? 0;
  return letters / text.length;
}

const MIN_LEN = 40;
const MAX_LEN = 1200;
const SHORT_BUCKET_PROBABILITY = 0.15;

export function targetLength(rng: Rng): number {
  if (rng() < SHORT_BUCKET_PROBABILITY) {
    return Math.round(20 + rng() * 60); // 20-80 first-clause fragments
  }
  const logMin = Math.log(MIN_LEN);
  const logMax = Math.log(MAX_LEN);
  return Math.round(Math.exp(logMin + rng() * (logMax - logMin)));
}

/** Greedily join sentences into windows near a drawn target length. */
export function chunkText(text: string, rng: Rng): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let current = '';
  let target = targetLength(rng);
  for (const sentence of sentences) {
    if (current.length === 0) {
      current = sentence;
    } else if (current.length + 1 + sentence.length <= Math.max(target, MAX_LEN)) {
      current = `${current} ${sentence}`;
    }
    if (current.length >= target) {
      chunks.push(current.slice(0, MAX_LEN));
      current = '';
      target = targetLength(rng);
    }
  }
  if (current.length >= 20) chunks.push(current.slice(0, MAX_LEN));
  return chunks.filter((c) => alphaFraction(c) >= 0.4);
}
