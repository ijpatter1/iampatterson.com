/**
 * CCLD — Compact Claudish Language Detector (inference).
 *
 * Loads the trained int8 weights (ccld-weights.json, ~36KB), asserts
 * the featurizer configHash — a mismatch refuses the model and detection
 * falls back to the regex heuristic rather than serving silently-wrong
 * probabilities — dequantizes per-tensor scales, and predicts through
 * the SAME forward pass the trainer evaluated (ccld-inference.ts).
 * Weights load via dynamic import (warmCcld) so the ~36KB payload stays
 * out of the base page chunk; until it lands, the heuristic answers.
 */
import { CCLD_CONFIG, CCLD_V2_CONFIG, configHash, extractFeatures } from './ccld-featurizer';
import { forwardLogits, probabilityClaudish } from './ccld-inference';

import type { CcldTensors } from './ccld-inference';

export interface CcldModel {
  /** Returns P(claudish) in [0, 1]. Synchronous; must never throw. */
  predict(text: string): number;
}

interface WeightsFile {
  version?: unknown;
  featurizer?: { configHash?: unknown };
  quant?: { scales?: Record<string, number> };
  tensors?: Record<string, string>;
  calibration?: { temperature?: number };
}

const TENSOR_NAMES = ['E1', 'E2', 'E3', 'E4', 'W1', 'b1', 'W2', 'b2'] as const;

function decodeBase64(data: string): Int8Array {
  if (typeof atob === 'function') {
    const binary = atob(data);
    const out = new Int8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      const byte = binary.charCodeAt(i);
      out[i] = byte > 127 ? byte - 256 : byte;
    }
    return out;
  }
  const buffer = Buffer.from(data, 'base64');
  return new Int8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

let model: CcldModel | null = null;
let warmed = false;

/** Parse a weights payload into a model, or null when it isn't usable. */
export function loadCcldModel(weights: unknown): CcldModel | null {
  if (typeof weights !== 'object' || weights === null) return null;
  const file = weights as WeightsFile;
  if (file.version !== 1) return null;
  // The parity contract: weights trained against a featurizer we don't
  // ship are refused outright — the heuristic is the safe answer path.
  // The embedded hash selects which BLESSED config to featurize with;
  // embedded config fields are informational and never trusted.
  const embeddedHash = file.featurizer?.configHash;
  const config =
    embeddedHash === configHash(CCLD_CONFIG)
      ? CCLD_CONFIG
      : embeddedHash === configHash(CCLD_V2_CONFIG)
        ? CCLD_V2_CONFIG
        : null;
  if (!config) return null;
  const scales = file.quant?.scales;
  const tensors = file.tensors;
  if (!scales || !tensors) return null;
  try {
    const dequantized: Float64Array[] = TENSOR_NAMES.map((name) => {
      const quantized = decodeBase64(tensors[name]);
      const scale = scales[name];
      const out = new Float64Array(quantized.length);
      for (let i = 0; i < quantized.length; i++) out[i] = quantized[i] * scale;
      return out;
    });
    const embeddingCount = config.buckets.length;
    const modelTensors: CcldTensors = {
      embeddings: dequantized.slice(0, embeddingCount),
      w1: dequantized[embeddingCount],
      b1: dequantized[embeddingCount + 1],
      w2: dequantized[embeddingCount + 2],
      b2: dequantized[embeddingCount + 3],
    };
    const temperature = file.calibration?.temperature ?? 1;
    return {
      predict(text: string): number {
        try {
          return probabilityClaudish(
            forwardLogits(extractFeatures(text, config), modelTensors),
            temperature
          );
        } catch {
          return 0.5; // neutral: the orchestrator treats this as unknown
        }
      },
    };
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget warm-up: dynamically imports the weights chunk so the
 * base page bundle stays free of the payload. Until this resolves (or
 * when it yields no model), the heuristic answers.
 */
export async function warmCcld(): Promise<void> {
  if (warmed) return;
  warmed = true;
  try {
    const weights = await import('./ccld-weights.json');
    model = loadCcldModel((weights as { default?: unknown }).default ?? weights);
  } catch {
    model = null;
  }
}

export function getCcldModel(): CcldModel | null {
  return model;
}

export function isCcldAvailable(): boolean {
  return model !== null;
}

/** Test-only: drop the cached model so warm-up can be exercised again. */
export function resetCcldForTests(): void {
  model = null;
  warmed = false;
}
