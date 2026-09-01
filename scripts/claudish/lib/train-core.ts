/**
 * CCLD trainer core — pure, importable (the grad-check Jest test drives
 * these functions directly). Backprop through: sparse fraction-weighted
 * embedding average → dense ReLU layer → softmax. Adam over the flat
 * parameter vector (~27k params).
 */
import { CCLD_CONFIG, extractFeatures } from '../../../src/lib/claudish/ccld-featurizer';

import type { CcldFeaturizerConfig } from '../../../src/lib/claudish/ccld-featurizer';
import { forwardLogits } from '../../../src/lib/claudish/ccld-inference';

import type { CcldTensors } from '../../../src/lib/claudish/ccld-inference';

export interface Model {
  tensors: CcldTensors;
  /** Flat views for the optimizer (same underlying buffers). */
  flat: Float64Array[];
}

export function tensorSizes(config: CcldFeaturizerConfig = CCLD_CONFIG): number[] {
  const dim = config.embeddingDim;
  const inputDim = config.orders.length * dim + (config.registerFeatures ?? 0);
  return [
    ...config.buckets.map((buckets) => buckets * dim),
    inputDim * config.hiddenDim,
    config.hiddenDim,
    config.hiddenDim * 2,
    2,
  ];
}

export function initModel(
  rng: () => number,
  config: CcldFeaturizerConfig = CCLD_CONFIG
): Model {
  const sizes = tensorSizes(config);
  const inputDim = config.orders.length * config.embeddingDim + (config.registerFeatures ?? 0);
  const flat = sizes.map((size) => new Float64Array(size));
  const scale = (n: number) => Math.sqrt(2 / n);
  // Small random init; He-ish for the dense layers.
  for (let t = 0; t < config.buckets.length; t++) {
    for (let i = 0; i < flat[t].length; i++) flat[t][i] = (rng() * 2 - 1) * 0.05;
  }
  const w1 = flat[config.buckets.length];
  for (let i = 0; i < w1.length; i++) w1[i] = (rng() * 2 - 1) * scale(inputDim);
  const w2 = flat[config.buckets.length + 2];
  for (let i = 0; i < w2.length; i++) w2[i] = (rng() * 2 - 1) * scale(config.hiddenDim);
  return {
    flat,
    tensors: {
      embeddings: flat.slice(0, config.buckets.length),
      w1: flat[config.buckets.length],
      b1: flat[config.buckets.length + 1],
      w2: flat[config.buckets.length + 2],
      b2: flat[config.buckets.length + 3],
    },
  };
}

export type Features = ReturnType<typeof extractFeatures>;

/** Forward + backward for one example; accumulates into grads; returns NLL. */
export function backprop(
  model: Model,
  features: Features,
  label: 0 | 1,
  grads: Float64Array[],
  config: CcldFeaturizerConfig = CCLD_CONFIG,
  registerVec?: Float64Array
): number {
  const { tensors } = model;
  const dim = config.embeddingDim;
  const hidden = config.hiddenDim;
  const charDim = config.orders.length * dim;
  const inputDim = charDim + (config.registerFeatures ?? 0);
  // Shape guard — the bug this parameter exists to prevent: training a
  // v1-shaped model while evaluating with v3 indexing (the invalid
  // first r9 run) passes every parity check because both sides share
  // the same wrong math. Sizes must match the config or nothing means
  // anything.
  if (tensors.b1.length !== hidden || tensors.w1.length !== inputDim * hidden) {
    throw new Error(
      `tensor shapes do not match config v${config.version}: b1=${tensors.b1.length} w1=${tensors.w1.length}`
    );
  }

  // Forward (kept in sync with the shipped forwardLogits — verified by
  // the parity check in train-ccld and the grad-check test).
  const x = new Float64Array(inputDim);
  if (registerVec) {
    for (let k = 0; k < registerVec.length; k++) x[charDim + k] = registerVec[k];
  }
  for (let order = 0; order < features.length; order++) {
    const embedding = tensors.embeddings[order];
    for (const [bucket, fraction] of features[order]) {
      const base = bucket * dim;
      const out = order * dim;
      for (let d = 0; d < dim; d++) x[out + d] += fraction * embedding[base + d];
    }
  }
  const hPre = new Float64Array(hidden);
  for (let j = 0; j < hidden; j++) {
    let sum = tensors.b1[j];
    for (let i = 0; i < inputDim; i++) sum += x[i] * tensors.w1[i * hidden + j];
    hPre[j] = sum;
  }
  const h = hPre.map((v) => (v > 0 ? v : 0));
  const z = [tensors.b2[0], tensors.b2[1]];
  for (let j = 0; j < hidden; j++) {
    z[0] += h[j] * tensors.w2[j * 2];
    z[1] += h[j] * tensors.w2[j * 2 + 1];
  }
  const max = Math.max(z[0], z[1]);
  const exp0 = Math.exp(z[0] - max);
  const exp1 = Math.exp(z[1] - max);
  const p1 = exp1 / (exp0 + exp1);
  const nll = -Math.log(label === 1 ? Math.max(p1, 1e-12) : Math.max(1 - p1, 1e-12));

  // Backward.
  const dz = [label === 0 ? -(1 - p1) + 0 : p1 - 0, 0];
  // softmax-CE gradient: dz_k = p_k - y_k
  const p0 = 1 - p1;
  dz[0] = p0 - (label === 0 ? 1 : 0);
  dz[1] = p1 - (label === 1 ? 1 : 0);

  const gEmb = grads.slice(0, config.buckets.length);
  const gW1 = grads[config.buckets.length];
  const gB1 = grads[config.buckets.length + 1];
  const gW2 = grads[config.buckets.length + 2];
  const gB2 = grads[config.buckets.length + 3];

  gB2[0] += dz[0];
  gB2[1] += dz[1];
  const dh = new Float64Array(hidden);
  for (let j = 0; j < hidden; j++) {
    gW2[j * 2] += h[j] * dz[0];
    gW2[j * 2 + 1] += h[j] * dz[1];
    dh[j] = hPre[j] > 0 ? tensors.w2[j * 2] * dz[0] + tensors.w2[j * 2 + 1] * dz[1] : 0;
  }
  const dx = new Float64Array(inputDim);
  for (let i = 0; i < inputDim; i++) {
    let sum = 0;
    for (let j = 0; j < hidden; j++) {
      gW1[i * hidden + j] += x[i] * dh[j];
      sum += tensors.w1[i * hidden + j] * dh[j];
    }
    dx[i] = sum;
  }
  for (let j = 0; j < hidden; j++) gB1[j] += dh[j];
  for (let order = 0; order < features.length; order++) {
    const g = gEmb[order];
    for (const [bucket, fraction] of features[order]) {
      const base = bucket * dim;
      const out = order * dim;
      for (let d = 0; d < dim; d++) g[base + d] += fraction * dx[out + d];
    }
  }
  return nll;
}

export class Adam {
  private m: Float64Array[];
  private v: Float64Array[];
  private t = 0;

  constructor(
    sizes: number[],
    private readonly lr = 0.003,
    private readonly beta1 = 0.9,
    private readonly beta2 = 0.999,
    private readonly eps = 1e-8
  ) {
    this.m = sizes.map((s) => new Float64Array(s));
    this.v = sizes.map((s) => new Float64Array(s));
  }

  step(params: Float64Array[], grads: Float64Array[], batchSize: number): void {
    this.t++;
    const correction1 = 1 - this.beta1 ** this.t;
    const correction2 = 1 - this.beta2 ** this.t;
    for (let tensor = 0; tensor < params.length; tensor++) {
      const p = params[tensor];
      const g = grads[tensor];
      const m = this.m[tensor];
      const v = this.v[tensor];
      for (let i = 0; i < p.length; i++) {
        const grad = g[i] / batchSize;
        m[i] = this.beta1 * m[i] + (1 - this.beta1) * grad;
        v[i] = this.beta2 * v[i] + (1 - this.beta2) * grad * grad;
        p[i] -= (this.lr * (m[i] / correction1)) / (Math.sqrt(v[i] / correction2) + this.eps);
        g[i] = 0;
      }
    }
  }
}

/** Convenience for eval paths: P(claudish) pre-temperature. */
export function predictP1(
  model: Model,
  features: Features,
  config: CcldFeaturizerConfig = CCLD_CONFIG
): number {
  const [z0, z1] = forwardLogits(features, model.tensors, config);
  return 1 / (1 + Math.exp(-(z1 - z0)));
}

export { extractFeatures, forwardLogits };
