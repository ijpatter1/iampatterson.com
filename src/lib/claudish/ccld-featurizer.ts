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
import { scoreClaudish } from './heuristic';
import { normalizeForDetection } from './text-stats';

export interface CcldFeaturizerConfig {
  /** v4: count of dense register features concatenated to the input. */
  registerFeatures?: number;
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
  /** v5: hashed word n-gram orders appended after the char orders (loop-2 D2). */
  wordOrders?: readonly number[];
  wordBuckets?: readonly number[];
  /** v6/v7: sentence-shape statistics appended after the register vector (loop-2 D3). */
  structureFeatures?: number;
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

/**
 * v3 = v2 + capacity: embedding dim 8 -> 16, hidden 48 -> 96 (~57k
 * params, ~76KB quantized). The capacity experiment for the round-trip
 * problem: at 27k params the model provably cannot fit contrastive
 * register-stripped negatives (r8 sweep, Decision #22); v3 tests
 * whether scale lets CCLD learn the register boundary instead of the
 * content field.
 */
export const CCLD_V3_CONFIG: CcldFeaturizerConfig = {
  ...CCLD_CONFIG,
  version: 3,
  maskModelNames: true,
  embeddingDim: 16,
  hiddenDim: 96,
};

/**
 * v4 = v2 capacity + DENSE REGISTER FEATURES. Three experiments proved
 * char 1-4-gram bags under-encode the register (multi-word patterns,
 * words past the window, sentence rhythm), so models fall back on
 * content shortcuts: r8 (contrastive dose) and r9b (2x capacity) both
 * fail to fit their own register-stripped negatives. v4 feeds the
 * register measurements directly: the heuristic's 8 family scores plus
 * 3 rhythm statistics, concatenated to the embedding average.
 */
export const REGISTER_FEATURE_COUNT = 11;

export const CCLD_V4_CONFIG: CcldFeaturizerConfig = {
  ...CCLD_CONFIG,
  version: 4,
  maskModelNames: true,
  registerFeatures: REGISTER_FEATURE_COUNT,
};

/**
 * v5 = v2 (mask) + hashed WORD unigram and bigram tables as two extra
 * embedding orders (loop-2 D2, 2026-09-02). Rationale: a character model
 * cannot tell "this word is a topic word that humans also use" from
 * register; word tables let the trainer put topic words on the human side
 * when human negatives carry them. Tokens: lowercase, punctuation-split,
 * identifiers with dots/underscores kept whole.
 */
export const CCLD_V5_CONFIG: CcldFeaturizerConfig = {
  ...CCLD_CONFIG,
  version: 5,
  maskModelNames: true,
  wordOrders: [1, 2],
  wordBuckets: [4096, 4096],
};

/** Count of the sentence-shape statistics defined below (loop-2 D3). */
export const STRUCTURE_FEATURE_COUNT = 12;

/** v6 = v4 + sentence-shape structure features (loop-2 D3, 2026-09-02). */
export const CCLD_V6_CONFIG: CcldFeaturizerConfig = {
  ...CCLD_V4_CONFIG,
  version: 6,
  structureFeatures: STRUCTURE_FEATURE_COUNT,
};

/** v7 = v5 word tables + register + structure (loop-2 D4 combination). */
export const CCLD_V7_CONFIG: CcldFeaturizerConfig = {
  ...CCLD_V5_CONFIG,
  version: 7,
  registerFeatures: REGISTER_FEATURE_COUNT,
  structureFeatures: STRUCTURE_FEATURE_COUNT,
};

export function wordTokens(text: string): string[] {
  return normalizeForDetection(text)
    .split(/[^a-z0-9._#@+-]+/i)
    .map((t) => t.replace(/^[._#@+-]+|[._#@+-]+$/g, '').toLowerCase())
    .filter((t) => t.length > 0);
}

/**
 * Dense register measurements in [0, ~1], frozen alongside the char
 * featurizer (same contract: a trained model's inputs never drift).
 * Order: the heuristic's 8 familyScores, then mean sentence length
 * (words / 40, capped), sentence-length stddev (/ 20, capped), and the
 * longest run of short (< 8 words) sentences (/ 6, capped).
 */
export function extractRegisterFeatures(text: string): Float64Array {
  const out = new Float64Array(REGISTER_FEATURE_COUNT);
  const h = scoreClaudish(text);
  for (let i = 0; i < 8; i++) out[i] = h.familyScores[i] ?? 0;
  const sentences = normalizeForDetection(text)
    // Whitespace-anchored so decimals (2.1) and dotted names (runbook.md)
    // don't shred into fake short sentences.
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .map((sentence) => sentence.split(' ').length);
  if (sentences.length > 0) {
    const mean = sentences.reduce((a, b) => a + b, 0) / sentences.length;
    const variance = sentences.reduce((a, b) => a + (b - mean) ** 2, 0) / sentences.length;
    out[8] = Math.min(1, mean / 40);
    out[9] = Math.min(1, Math.sqrt(variance) / 20);
    let run = 0;
    let maxRun = 0;
    for (const words of sentences) {
      run = words < 8 ? run + 1 : 0;
      if (run > maxRun) maxRun = run;
    }
    out[10] = Math.min(1, maxRun / 6);
  }
  return out;
}

/**
 * Sentence-shape statistics in [0, 1], frozen like the register vector.
 * These measure how prose is built (clauses, openers, punctuation habits,
 * rhythm), not which words it uses, so a topic shared by human and
 * Claude prose cannot leak through them.
 */
export const STRUCTURE_INDEX = {
  clausesPerSentence: 0,
  colonShare: 1,
  appositiveRate: 2,
  determinerOpenerShare: 3,
  firstPersonOpenerShare: 4,
  ingOrLyOpenerShare: 5,
  questionShare: 6,
  parentheticalRate: 7,
  dashRate: 8,
  contractionRate: 9,
  listMarkerRate: 10,
  lengthCv: 11,
} as const;

export function extractStructureFeatures(text: string): Float64Array {
  const out = new Float64Array(STRUCTURE_FEATURE_COUNT);
  const sentences = normalizeForDetection(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const n = sentences.length;
  if (n === 0) return out;
  const count = (re: RegExp, s: string): number => (s.match(re) ?? []).length;
  let clauses = 0;
  let colons = 0;
  let appositives = 0;
  let determiners = 0;
  let firstPerson = 0;
  let ingOrLy = 0;
  let questions = 0;
  let parentheticals = 0;
  let dashes = 0;
  let contractions = 0;
  let words = 0;
  const lengths: number[] = [];
  for (const s of sentences) {
    const tokens = s.split(' ');
    lengths.push(tokens.length);
    words += tokens.length;
    clauses += count(/[,;]|\s[—–-]\s/g, s);
    if (s.includes(':')) colons++;
    appositives += count(/,\s+(?:a|an|the|which|not|especially|particularly)\b/gi, s);
    const first = (tokens[0] ?? '').replace(/^[^a-z']+|[^a-z']+$/gi, '').toLowerCase();
    if (/^(?:the|this|that|these|those|it|there)$/.test(first)) determiners++;
    if (/^(?:i|i'm|i've|i'll|i'd|we|we're|we've|we'll|my|our)$/.test(first)) firstPerson++;
    if (first.length > 4 && /^(?:[a-z]+ing|[a-z]+ly)$/.test(first)) ingOrLy++;
    if (s.endsWith('?')) questions++;
    parentheticals += count(/\(/g, s);
    dashes += count(/—|–|\s-\s/g, s);
    contractions += count(/\b[a-z]+'(?:t|s|re|ll|ve|d|m)\b/gi, s);
  }
  out[STRUCTURE_INDEX.clausesPerSentence] = Math.min(1, clauses / n / 4);
  out[STRUCTURE_INDEX.colonShare] = colons / n;
  out[STRUCTURE_INDEX.appositiveRate] = Math.min(1, appositives / n / 2);
  out[STRUCTURE_INDEX.determinerOpenerShare] = determiners / n;
  out[STRUCTURE_INDEX.firstPersonOpenerShare] = firstPerson / n;
  out[STRUCTURE_INDEX.ingOrLyOpenerShare] = ingOrLy / n;
  out[STRUCTURE_INDEX.questionShare] = questions / n;
  out[STRUCTURE_INDEX.parentheticalRate] = Math.min(1, parentheticals / n / 2);
  out[STRUCTURE_INDEX.dashRate] = Math.min(1, dashes / n / 2);
  out[STRUCTURE_INDEX.contractionRate] = Math.min(1, (contractions / Math.max(1, words)) * 10);
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  out[STRUCTURE_INDEX.listMarkerRate] =
    lines.length === 0 ? 0 : Math.min(1, lines.filter((line) => /^(?:[-*•]\s|\d+[.)]\s|#{1,6}\s)/.test(line)).length / lines.length);
  const mean = words / n;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  out[STRUCTURE_INDEX.lengthCv] = Math.min(1, Math.sqrt(variance) / Math.max(1, mean));
  return out;
}

/**
 * The dense input a config asks for: register vector (v4+), then
 * structure vector (v6+), or undefined when the config uses neither.
 */
export function extractDenseFeatures(text: string, config: CcldFeaturizerConfig): Float64Array | undefined {
  const r = config.registerFeatures ?? 0;
  const s = config.structureFeatures ?? 0;
  if (r + s === 0) return undefined;
  const out = new Float64Array(r + s);
  if (r > 0) out.set(extractRegisterFeatures(text).subarray(0, r), 0);
  if (s > 0) out.set(extractStructureFeatures(text).subarray(0, s), r);
  return out;
}

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
  const wordOrders = config.wordOrders ?? [];
  const out: Array<Map<number, number>> = [...config.orders, ...wordOrders].map(() => new Map());
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
  if (wordOrders.length > 0) {
    const tokens = wordTokens(normalized);
    const wordBuckets = config.wordBuckets ?? [];
    for (let w = 0; w < wordOrders.length; w++) {
      const n = wordOrders[w];
      const buckets = wordBuckets[w];
      const counts = out[config.orders.length + w];
      const windows = tokens.length - n + 1;
      if (windows <= 0 || !buckets) continue;
      for (let i = 0; i < windows; i++) {
        const bucket = fnv1a32(tokens.slice(i, i + n).join(' ')) % buckets;
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      }
      for (const [bucket, count] of counts) counts.set(bucket, count / windows);
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
