/**
 * CCLD — Compact Claudish Language Detector (inference shell).
 *
 * The committed ccld-weights.json is a version-0 placeholder until the M5
 * training pipeline exports real weights; version 0 means "no model", and
 * detection falls back to the regex heuristic (src/lib/claudish/heuristic.ts).
 * Keeping this module and the JSON present from day one keeps every import
 * path static — no conditional module resolution anywhere — and means the
 * production fallback path is exercised for real until training lands.
 *
 * When M5 lands: version becomes 1, the file carries the featurizer config
 * (with configHash), int8 tensors, and calibration; loadCcldModel() gains
 * the dequantize + forward pass, and the configHash is asserted against
 * the shipped featurizer before the model is served.
 */

export interface CcldModel {
  /** Returns P(claudish) in [0, 1]. Synchronous; must never throw. */
  predict(text: string): number;
}

let model: CcldModel | null = null;
let warmed = false;

/** Parse a weights payload into a model, or null when it isn't a usable model. */
export function loadCcldModel(weights: unknown): CcldModel | null {
  if (
    typeof weights !== 'object' ||
    weights === null ||
    (weights as { version?: unknown }).version !== 1
  ) {
    return null;
  }
  // Version-1 inference arrives with the trained weights (M5). Until then a
  // version-1 payload without tensors is treated as unusable.
  return null;
}

/**
 * Fire-and-forget warm-up: dynamically imports the weights chunk so the
 * base page bundle stays free of the ~36KB base64 payload. Until this
 * resolves (or when it yields no model), the heuristic answers.
 */
export async function warmCcld(): Promise<void> {
  if (warmed) return;
  warmed = true;
  try {
    const weights = await import('./ccld-weights.json');
    model = loadCcldModel(weights.default ?? weights);
  } catch {
    model = null; // heuristic remains the answer path
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
