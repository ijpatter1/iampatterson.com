/**
 * CCLD trainer — trains Config A on the built dataset, calibrates
 * temperature on dev, quantizes to int8 symmetric per-tensor, evaluates
 * the QUANTIZED model through the SHIPPED forward pass, and exports:
 *   src/lib/claudish/ccld-weights.json   (the committed artifact)
 *   src/lib/claudish/ccld-metrics.json   (what the model card quotes)
 *   src/lib/claudish/ccld-fixtures.json  (parity probes for Jest)
 *
 * Usage: npx ts-node -P tsconfig.scripts.json -T scripts/claudish/train-ccld.ts \
 *          [--epochs 12] [--max-train 60000] [--batch 128]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { seededRng } from './lib/chunk';
import {
  Adam,
  backprop,
  extractFeatures,
  initModel,
  tensorSizes,
} from './lib/train-core';
import {
  CCLD_CONFIG,
  CCLD_V2_CONFIG,
  CCLD_V3_CONFIG,
  configHash,
  fnv1a32,
} from '../../src/lib/claudish/ccld-featurizer';

// MASK_MODEL_NAMES=1 trains against the v2 featurizer (model names →
// neutral token; see CCLD_V2_CONFIG). The shipped loader blesses both
// hashes, so v1 and v2 models coexist in the registry.
// CCLD_CAPACITY=v3 selects the scaled config (mask + dim 16 + hidden 96);
// MASK_MODEL_NAMES=1 alone keeps v2 (mask at original capacity).
const TRAIN_CONFIG =
  process.env.CCLD_CAPACITY === 'v3'
    ? CCLD_V3_CONFIG
    : process.env.MASK_MODEL_NAMES === '1'
      ? CCLD_V2_CONFIG
      : CCLD_CONFIG;
import {
  forwardLogits,
  probabilityClaudish,
} from '../../src/lib/claudish/ccld-inference';

import type { Model } from './lib/train-core';
import type { CcldTensors } from '../../src/lib/claudish/ccld-inference';

interface Example {
  text: string;
  label: 0 | 1;
  group: string;
  source: string;
  split: 'train' | 'dev' | 'test';
  heldOutProject?: boolean;
}

const args = process.argv.slice(2);
const argOf = (flag: string, fallback: number) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const EPOCHS = argOf('--epochs', 12);
const MAX_TRAIN = argOf('--max-train', 60000);
const BATCH = argOf('--batch', 128);

function quantize(model: Model): {
  tensors: CcldTensors;
  quantized: Int8Array[];
  scales: number[];
} {
  const quantized: Int8Array[] = [];
  const scales: number[] = [];
  const dequantized: Float64Array[] = [];
  for (const tensor of model.flat) {
    let max = 1e-9;
    for (const value of tensor) max = Math.max(max, Math.abs(value));
    const scale = max / 127;
    const q = new Int8Array(tensor.length);
    const d = new Float64Array(tensor.length);
    for (let i = 0; i < tensor.length; i++) {
      q[i] = Math.max(-127, Math.min(127, Math.round(tensor[i] / scale)));
      d[i] = q[i] * scale;
    }
    quantized.push(q);
    scales.push(scale);
    dequantized.push(d);
  }
  const embeddingCount = TRAIN_CONFIG.buckets.length;
  return {
    quantized,
    scales,
    tensors: {
      embeddings: dequantized.slice(0, embeddingCount),
      w1: dequantized[embeddingCount],
      b1: dequantized[embeddingCount + 1],
      w2: dequantized[embeddingCount + 2],
      b2: dequantized[embeddingCount + 3],
    },
  };
}

function evaluate(
  tensors: CcldTensors,
  temperature: number,
  examples: Example[]
): {
  n: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusion: { tp: number; fp: number; tn: number; fn: number };
  brier: number;
  byLength: Record<string, { n: number; accuracy: number }>;
  bySource: Record<string, { n: number; accuracy: number }>;
} {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let brier = 0;
  const byLength = new Map<string, { n: number; correct: number }>();
  const bySource = new Map<string, { n: number; correct: number }>();
  const bucketOf = (len: number) =>
    len < 40 ? '20-40' : len < 80 ? '40-80' : len < 160 ? '80-160' : len < 320 ? '160-320' : len < 640 ? '320-640' : '640-1200';
  for (const example of examples) {
    const p = probabilityClaudish(forwardLogits(extractFeatures(example.text, TRAIN_CONFIG), tensors, TRAIN_CONFIG), temperature);
    const predicted = p >= 0.5 ? 1 : 0;
    const correct = predicted === example.label;
    if (example.label === 1) {
      if (predicted === 1) tp++;
      else fn++;
    } else if (predicted === 1) fp++;
    else tn++;
    brier += (p - example.label) ** 2;
    for (const [map, key] of [
      [byLength, bucketOf(example.text.length)] as const,
      [bySource, example.label === 1 ? 'claudish' : example.source] as const,
    ]) {
      const entry = map.get(key) ?? { n: 0, correct: 0 };
      entry.n++;
      if (correct) entry.correct++;
      map.set(key, entry);
    }
  }
  const n = examples.length;
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  return {
    n,
    accuracy: (tp + tn) / Math.max(1, n),
    precision,
    recall,
    f1: (2 * precision * recall) / Math.max(1e-9, precision + recall),
    confusion: { tp, fp, tn, fn },
    brier: brier / Math.max(1, n),
    byLength: Object.fromEntries(
      [...byLength].map(([k, v]) => [k, { n: v.n, accuracy: v.correct / v.n }])
    ),
    bySource: Object.fromEntries(
      [...bySource].map(([k, v]) => [k, { n: v.n, accuracy: v.correct / v.n }])
    ),
  };
}

function fitTemperature(tensors: CcldTensors, dev: Example[]): number {
  const logitDiffs = dev.map((example) => {
    const [z0, z1] = forwardLogits(extractFeatures(example.text, TRAIN_CONFIG), tensors, TRAIN_CONFIG);
    return { diff: z1 - z0, label: example.label };
  });
  let best = 1;
  let bestNll = Infinity;
  for (let t = 0.5; t <= 4.01; t += 0.05) {
    let nll = 0;
    for (const { diff, label } of logitDiffs) {
      const p = 1 / (1 + Math.exp(-diff / t));
      nll += -Math.log(Math.max(label === 1 ? p : 1 - p, 1e-12));
    }
    if (nll < bestNll) {
      bestNll = nll;
      best = t;
    }
  }
  return Math.round(best * 100) / 100;
}

function toBase64(int8: Int8Array): string {
  return Buffer.from(int8.buffer, int8.byteOffset, int8.byteLength).toString('base64');
}

async function main(): Promise<void> {
  const corpusDir = path.join(homedir(), '.claudish-corpus');
  const examples: Example[] = readFileSync(path.join(corpusDir, 'dataset.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Example);
  const rng = seededRng(1337);
  const train = examples.filter((e) => e.split === 'train' && !e.heldOutProject).slice(0, MAX_TRAIN);
  const dev = examples.filter((e) => e.split === 'dev' && !e.heldOutProject);
  const test = examples.filter((e) => e.split === 'test' && !e.heldOutProject);
  const heldOut = examples.filter((e) => e.heldOutProject);
  console.log(`[train] train=${train.length} dev=${dev.length} test=${test.length} heldOutProject=${heldOut.length}`);

  const model = initModel(rng, TRAIN_CONFIG);
  const optimizer = new Adam(tensorSizes(TRAIN_CONFIG), 0.003);
  const grads = tensorSizes(TRAIN_CONFIG).map((size) => new Float64Array(size));

  let bestDevNll = Infinity;
  let bestSnapshot: Float64Array[] | null = null;
  let patience = 0;
  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    const t0 = Date.now();
    // Seeded shuffle per epoch.
    const order = [...train.keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let trainNll = 0;
    let inBatch = 0;
    for (const index of order) {
      const example = train[index];
      trainNll += backprop(model, extractFeatures(example.text, TRAIN_CONFIG), example.label, grads, TRAIN_CONFIG);
      inBatch++;
      if (inBatch === BATCH) {
        optimizer.step(model.flat, grads, BATCH);
        inBatch = 0;
      }
    }
    if (inBatch > 0) optimizer.step(model.flat, grads, inBatch);

    let devNll = 0;
    for (const example of dev) {
      const [z0, z1] = forwardLogits(extractFeatures(example.text, TRAIN_CONFIG), model.tensors, TRAIN_CONFIG);
      const p = 1 / (1 + Math.exp(-(z1 - z0)));
      devNll += -Math.log(Math.max(example.label === 1 ? p : 1 - p, 1e-12));
    }
    devNll /= dev.length;
    console.log(
      `[train] epoch ${epoch}: trainNLL=${(trainNll / train.length).toFixed(4)} devNLL=${devNll.toFixed(4)} (${Math.round((Date.now() - t0) / 1000)}s)`
    );
    if (devNll < bestDevNll - 1e-4) {
      bestDevNll = devNll;
      bestSnapshot = model.flat.map((tensor) => new Float64Array(tensor));
      patience = 0;
    } else if (++patience >= 2) {
      console.log('[train] early stop');
      break;
    }
  }
  if (bestSnapshot) {
    for (let t = 0; t < model.flat.length; t++) model.flat[t].set(bestSnapshot[t]);
  }

  console.log('[train] quantizing + calibrating...');
  const { tensors: quantizedTensors, quantized, scales } = quantize(model);
  const temperature = fitTemperature(quantizedTensors, dev);
  console.log(`[train] temperature=${temperature}`);

  const metrics = {
    trainedAt: new Date().toISOString(),
    configHash: configHash(TRAIN_CONFIG),
    temperature,
    dev: evaluate(quantizedTensors, temperature, dev),
    test: evaluate(quantizedTensors, temperature, test),
    projectHeldOut: evaluate(quantizedTensors, temperature, heldOut),
    train: { n: train.length },
  };
  console.log(
    `[train] dev acc=${metrics.dev.accuracy.toFixed(4)} test acc=${metrics.test.accuracy.toFixed(4)} heldOut acc=${metrics.projectHeldOut.accuracy.toFixed(4)}`
  );

  // Ranked most-Claudish n-grams: mean positive feature vector, then the
  // logit-difference sensitivity of each frequent bucket, with collision
  // sets disclosed (hashing is not injective; say so, don't hide it).
  const gramCounts: Array<Map<number, Map<string, number>>> = TRAIN_CONFIG.orders.map(
    () => new Map()
  );
  const positives = train.filter((e) => e.label === 1).slice(0, 8000);
  for (const example of positives) {
    const normalized = example.text.toLowerCase().replace(/\s+/g, ' ').trim();
    const points = Array.from(` ${normalized} `);
    for (let orderIndex = 0; orderIndex < TRAIN_CONFIG.orders.length; orderIndex++) {
      const n = TRAIN_CONFIG.orders[orderIndex];
      for (let i = 0; i + n <= points.length; i++) {
        const gram = points.slice(i, i + n).join('');
        const bucket = fnv1a32(gram) % TRAIN_CONFIG.buckets[orderIndex];
        let grams = gramCounts[orderIndex].get(bucket);
        if (!grams) gramCounts[orderIndex].set(bucket, (grams = new Map()));
        grams.set(gram, (grams.get(gram) ?? 0) + 1);
      }
    }
  }
  const meanFeatures = TRAIN_CONFIG.orders.map(() => new Map<number, number>());
  for (const example of positives.slice(0, 2000)) {
    const features = extractFeatures(example.text, TRAIN_CONFIG);
    for (let o = 0; o < features.length; o++) {
      for (const [bucket, fraction] of features[o]) {
        meanFeatures[o].set(bucket, (meanFeatures[o].get(bucket) ?? 0) + fraction / 2000);
      }
    }
  }
  const baseline = forwardLogits(meanFeatures, quantizedTensors, TRAIN_CONFIG);
  const ranked: Array<{ gram: string; order: number; sensitivity: number; count: number; collisions: string[] }> = [];
  for (let o = 0; o < TRAIN_CONFIG.orders.length; o++) {
    for (const [bucket, grams] of gramCounts[o]) {
      const total = [...grams.values()].reduce((a, b) => a + b, 0);
      if (total < 200) continue;
      const bumped = meanFeatures.map((m, i) => (i === o ? new Map(m) : m));
      bumped[o].set(bucket, (bumped[o].get(bucket) ?? 0) + 0.01);
      const [z0, z1] = forwardLogits(bumped, quantizedTensors, TRAIN_CONFIG);
      const sensitivity = z1 - z0 - (baseline[1] - baseline[0]);
      const sorted = [...grams.entries()].sort((a, b) => b[1] - a[1]);
      ranked.push({
        gram: sorted[0][0],
        order: TRAIN_CONFIG.orders[o],
        sensitivity: Math.round(sensitivity * 10000) / 10000,
        count: sorted[0][1],
        collisions: sorted.slice(1, 4).map(([gram]) => gram),
      });
    }
  }
  ranked.sort((a, b) => b.sensitivity - a.sensitivity);
  const topNgrams = ranked.slice(0, 40);

  // Train exports land in the REGISTRY staging area, never straight into
  // src/ — promotion is an explicit decision (model-registry.ts promote),
  // and this session twice caught the trainer silently replacing the
  // shipped model during sweeps.
  const libDir = path.join(homedir(), '.claudish-corpus', 'models', '_last-train');
  mkdirSync(libDir, { recursive: true });
  const tensorNames = ['E1', 'E2', 'E3', 'E4', 'W1', 'b1', 'W2', 'b2'];
  const weights = {
    version: 1,
    featurizer: { ...TRAIN_CONFIG, configHash: configHash() },
    arch: { hidden: TRAIN_CONFIG.hiddenDim, classes: ['english', 'claudish'] },
    quant: {
      scheme: 'int8-symmetric-per-tensor',
      scales: Object.fromEntries(tensorNames.map((name, i) => [name, scales[i]])),
    },
    tensors: Object.fromEntries(tensorNames.map((name, i) => [name, toBase64(quantized[i])])),
    calibration: {
      temperature,
      enterThreshold: 0.8,
      exitThreshold: 0.55,
      minChars: 24,
      minDwellMs: 250,
    },
    training: {
      trainedAt: metrics.trainedAt,
      seed: 1337,
      epochs: EPOCHS,
      examples: train.length,
      devNll: Math.round(bestDevNll * 10000) / 10000,
    },
  };
  writeFileSync(path.join(libDir, 'ccld-weights.json'), JSON.stringify(weights));
  writeFileSync(
    path.join(libDir, 'ccld-metrics.json'),
    JSON.stringify({ ...metrics, topNgrams }, null, 2)
  );

  // Fixtures: hand-written probe strings (never corpus text) with the
  // quantized model's outputs, replayed by Jest for parity.
  const probes = [
    '',
    'a',
    'banana',
    ' — ',
    "It's not a gap; it's a line.",
    'The meeting moved to Thursday. Bring the numbers.',
    "This isn't just a refactor — it's a robust, seamless transformation, underscoring everything.",
  ];
  const fixtures = {
    featurizerConfigHash: configHash(),
    inferenceCases: probes.map((text) => {
      const [z0, z1] = forwardLogits(extractFeatures(text, TRAIN_CONFIG), quantizedTensors, TRAIN_CONFIG);
      return {
        text,
        logits: [Math.round(z0 * 1e6) / 1e6, Math.round(z1 * 1e6) / 1e6],
        p: Math.round(probabilityClaudish([z0, z1], temperature) * 1e6) / 1e6,
      };
    }),
  };
  writeFileSync(path.join(libDir, 'ccld-fixtures.json'), JSON.stringify(fixtures, null, 2));
  const weightsBytes = readFileSync(path.join(libDir, 'ccld-weights.json')).length;
  console.log(`[train] exported to registry staging (${weightsBytes} bytes): ${libDir}`);
  console.log('[train] to ship: model-registry.ts archive <tag> "<note>" (from _last-train), then promote <tag>');
}

void main();
