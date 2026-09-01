/**
 * Minimal CCLD weights loader for the judge — a server-side port of
 * src/lib/claudish/ccld.ts's loadCcldModel over the vendored featurizer
 * and inference modules. Kept separate from the frontend loader because
 * the frontend module carries warmCcld's dynamic weights import, which
 * has no meaning in the service. Behavior-pinned against the frontend
 * loader in judge.test.ts.
 */
import {
  CCLD_CONFIG,
  CCLD_V2_CONFIG,
  CCLD_V3_CONFIG,
  CCLD_V4_CONFIG,
  configHash,
  extractFeatures,
  extractRegisterFeatures,
} from './vendor/ccld-featurizer';
import { forwardLogits, probabilityClaudish } from './vendor/ccld-inference';

import type { CcldFeaturizerConfig } from './vendor/ccld-featurizer';
import type { CcldTensors } from './vendor/ccld-inference';

const TENSOR_NAMES = ['E1', 'E2', 'E3', 'E4', 'W1', 'b1', 'W2', 'b2'] as const;

interface WeightsFile {
  version?: unknown;
  featurizer?: { configHash?: unknown };
  quant?: { scales?: Record<string, number> };
  tensors?: Record<string, string>;
  calibration?: { temperature?: number };
}

export interface JudgeModel {
  predict(text: string): number;
}

export function loadJudgeModel(weights: unknown): JudgeModel | null {
  if (typeof weights !== 'object' || weights === null) return null;
  const file = weights as WeightsFile;
  if (file.version !== 1) return null;
  const embeddedHash = file.featurizer?.configHash;
  const config: CcldFeaturizerConfig | null =
    embeddedHash === configHash(CCLD_CONFIG)
      ? CCLD_CONFIG
      : embeddedHash === configHash(CCLD_V2_CONFIG)
        ? CCLD_V2_CONFIG
        : embeddedHash === configHash(CCLD_V3_CONFIG)
          ? CCLD_V3_CONFIG
          : embeddedHash === configHash(CCLD_V4_CONFIG)
            ? CCLD_V4_CONFIG
            : null;
  if (!config) return null;
  const scales = file.quant?.scales;
  const tensors = file.tensors;
  if (!scales || !tensors) return null;
  try {
    const dequantized = TENSOR_NAMES.map((name) => {
      const buffer = Buffer.from(tensors[name], 'base64');
      const quantized = new Int8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const scale = scales[name];
      const out = new Float64Array(quantized.length);
      for (let i = 0; i < quantized.length; i++) out[i] = quantized[i] * scale;
      return out;
    });
    const modelTensors: CcldTensors = {
      embeddings: dequantized.slice(0, config.buckets.length),
      w1: dequantized[config.buckets.length],
      b1: dequantized[config.buckets.length + 1],
      w2: dequantized[config.buckets.length + 2],
      b2: dequantized[config.buckets.length + 3],
    };
    const temperature = file.calibration?.temperature ?? 1;
    return {
      predict(text: string): number {
        try {
          return probabilityClaudish(
            forwardLogits(
              extractFeatures(text, config),
              modelTensors,
              config,
              config.registerFeatures ? extractRegisterFeatures(text) : undefined
            ),
            temperature
          );
        } catch {
          return 0.5;
        }
      },
    };
  } catch {
    return null;
  }
}
