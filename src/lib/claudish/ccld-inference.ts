/**
 * CCLD inference core — the forward pass, shipped and dependency-free.
 *
 * Shared in BOTH directions: the browser's ccld.ts calls it with
 * dequantized tensors, and the trainer imports it for final evaluation
 * and fixture generation — so the shipped math IS the evaluated math
 * (structural parity, same as the featurizer contract).
 */
import { CCLD_CONFIG } from './ccld-featurizer';

import type { CcldFeaturizerConfig, extractFeatures } from './ccld-featurizer';

export interface CcldTensors {
  /** Per order: Float64Array(buckets * embeddingDim). */
  embeddings: Float64Array[];
  w1: Float64Array; // [inputDim][hiddenDim]
  b1: Float64Array;
  w2: Float64Array; // [hiddenDim][2]
  b2: Float64Array;
}

export const INPUT_DIM = CCLD_CONFIG.orders.length * CCLD_CONFIG.embeddingDim;

/** Returns raw logits [english, claudish] (before temperature). */
export function forwardLogits(
  features: ReturnType<typeof extractFeatures>,
  tensors: CcldTensors,
  config: CcldFeaturizerConfig = CCLD_CONFIG,
  registerVec?: Float64Array
): [number, number] {
  const dim = config.embeddingDim;
  // Word orders (v5) ride after the char orders; the register vector after both.
  const charDim = (config.orders.length + (config.wordOrders?.length ?? 0)) * dim;
  const inputDim = charDim + (config.registerFeatures ?? 0);
  const hidden = tensors.b1.length;
  const x = new Float64Array(inputDim);
  if (registerVec) {
    for (let k = 0; k < registerVec.length; k++) x[charDim + k] = registerVec[k];
  }
  for (let order = 0; order < features.length; order++) {
    const embedding = tensors.embeddings[order];
    for (const [bucket, fraction] of features[order]) {
      const base = bucket * dim;
      const out = order * dim;
      for (let d = 0; d < dim; d++) {
        x[out + d] += fraction * embedding[base + d];
      }
    }
  }
  const h = new Float64Array(hidden);
  for (let j = 0; j < hidden; j++) {
    let sum = tensors.b1[j];
    for (let i = 0; i < inputDim; i++) {
      sum += x[i] * tensors.w1[i * hidden + j];
    }
    h[j] = sum > 0 ? sum : 0;
  }
  let z0 = tensors.b2[0];
  let z1 = tensors.b2[1];
  for (let j = 0; j < hidden; j++) {
    z0 += h[j] * tensors.w2[j * 2];
    z1 += h[j] * tensors.w2[j * 2 + 1];
  }
  return [z0, z1];
}

/** P(claudish) with temperature scaling. */
export function probabilityClaudish(
  logits: [number, number],
  temperature: number
): number {
  const scaled = (logits[1] - logits[0]) / temperature;
  return 1 / (1 + Math.exp(-scaled));
}
