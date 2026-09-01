/**
 * CCLD featurizer — FROZEN once a model trains against it.
 *
 * CLD3's architecture (hashed char n-gram fractions → small embeddings,
 * averaged, one ReLU layer, softmax) with two deliberate divergences,
 * both documented in the model card: spaces are INCLUDED in n-grams
 * (punctuation-and-spacing habits like " — " ARE the signal we detect,
 * where CLD3 was discriminating scripts) and we run orders 1-4 at
 * compact bucket counts (Config A: 96/512/1536/1024 × dim 8).
 *
 * Parity contract: the trainer (scripts/claudish/train-ccld.ts) imports
 * THIS module — there is no second implementation to drift. configHash()
 * is embedded in exported weights and asserted at model load; a mismatch
 * refuses the model and falls back to the heuristic.
 *
 * Pipeline: NFC → lowercase → collapse whitespace → trim → pad with one
 * space each side → per order n, slide code-point windows → fraction =
 * count/windows → bucket = fnv1a32(utf8(gram)) % buckets[order].
 */
import { normalizeForDetection } from './text-stats';

export interface CcldFeaturizerConfig {
  version: number;
  orders: readonly number[];
  buckets: readonly number[];
  embeddingDim: number;
  hiddenDim: number;
  lowercase: boolean;
  collapseWhitespace: boolean;
  includeSpaces: boolean;
  pad: string;
  hash: string;
  /** v2: mask model names to a neutral token before n-gram extraction. */
  maskModelNames?: boolean;
}

export const CCLD_CONFIG = {
  version: 1,
  orders: [1, 2, 3, 4],
  buckets: [96, 512, 1536, 1024],
  embeddingDim: 8,
  hiddenDim: 48,
  lowercase: true,
  collapseWhitespace: true,
  includeSpaces: true,
  pad: ' ',
  hash: 'fnv1a32-utf8',
} as const;

/**
 * v2 = v1 + model-name masking. Under v1, human text ABOUT Claude
 * convicts: "claude"/"opus"/"haiku" n-grams exist only in the positive
 * class because every negative source predates Claude (the pre-2022
 * hard cut that guarantees human authorship also guarantees zero Claude
 * mentions). Masking the names to a neutral English token at featurize
 * time — train and inference share this code path — removes topic
 * identity while the register signal survives. Applied AFTER lowercase.
 */
export const MODEL_NAME_RE =
  /\b(claude|claudish|opus|haiku|sonnet|fable|gemini|chatgpt|gpt-?\d*|anthropic|openai|llms?)\b/g;

export const CCLD_V2_CONFIG: CcldFeaturizerConfig = {
  ...CCLD_CONFIG,
  version: 2,
  maskModelNames: true,
};

/** FNV-1a 32-bit over UTF-8 bytes (portable across any reimplementation). */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  // Math.imul keeps the 32-bit multiply exact (plain * loses precision
  // past 2^53 and silently corrupts multi-byte hashes).
  const mix = (byte: number) => {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  };
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i) as number;
    if (code > 0xffff) i++; // consumed a surrogate pair
    if (code < 0x80) {
      mix(code);
    } else if (code < 0x800) {
      mix(0xc0 | (code >> 6));
      mix(0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      mix(0xe0 | (code >> 12));
      mix(0x80 | ((code >> 6) & 0x3f));
      mix(0x80 | (code & 0x3f));
    } else {
      mix(0xf0 | (code >> 18));
      mix(0x80 | ((code >> 12) & 0x3f));
      mix(0x80 | ((code >> 6) & 0x3f));
      mix(0x80 | (code & 0x3f));
    }
  }
  return hash >>> 0;
}

/**
 * Per order (in CCLD_CONFIG.orders order): a map of bucket → fraction.
 * Fractions per order sum to 1 (a convex weighting of embedding rows).
 */
export function extractFeatures(
  text: string,
  config: CcldFeaturizerConfig = CCLD_CONFIG
): Array<Map<number, number>> {
  let normalized = normalizeForDetection(text);
  if (config.maskModelNames) normalized = normalized.replace(MODEL_NAME_RE, 'name');
  const out: Array<Map<number, number>> = config.orders.map(() => new Map());
  if (normalized.length === 0) return out;
  const padded = `${config.pad}${normalized}${config.pad}`;
  const points = Array.from(padded); // code-point iteration
  for (let orderIndex = 0; orderIndex < config.orders.length; orderIndex++) {
    const n = config.orders[orderIndex];
    const buckets = config.buckets[orderIndex];
    const windows = points.length - n + 1;
    if (windows <= 0) continue;
    const counts = out[orderIndex];
    for (let i = 0; i < windows; i++) {
      const bucket = fnv1a32(points.slice(i, i + n).join('')) % buckets;
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    for (const [bucket, count] of counts) {
      counts.set(bucket, count / windows);
    }
  }
  return out;
}

/** SHA-256 over a featurizer config, embedded in weights and asserted at load. */
export function configHash(config: CcldFeaturizerConfig = CCLD_CONFIG): string {
  // Dependency-free synchronous hash: stable JSON of the config through
  // fnv1a32 would be too weak for a 64-hex contract; use a tiny SHA-256.
  return sha256Hex(JSON.stringify(config));
}

// --- minimal SHA-256 (public-domain style implementation) ---
function sha256Hex(input: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
    0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];
  const bytes: number[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0) as number;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
  }
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) bytes.push((bitLength / 2 ** shift) & 0xff);

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
    0x5be0cd19,
  ];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] =
        ((bytes[block + t * 4] << 24) |
          (bytes[block + t * 4 + 1] << 16) |
          (bytes[block + t * 4 + 2] << 8) |
          bytes[block + t * 4 + 3]) >>>
        0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = (rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}
