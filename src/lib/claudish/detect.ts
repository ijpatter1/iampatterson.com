/**
 * Claudish translator — detection orchestration.
 *
 * detectClaudish() is the entire detection API the frontend consumes:
 * synchronous, pure, never throws, never touches the network. It answers
 * from the CCLD model when one is loaded and hash-valid, and from the
 * regex heuristic otherwise (the bootstrap path, and the permanent
 * fallback). createDetectionLatch() adds the UI hysteresis so the
 * "Claudish - detected" label is stable while the visitor types.
 */
import { getCcldModel, warmCcld } from './ccld';
import { scoreClaudish } from './heuristic';
import { normalizeForDetection } from './text-stats';
import type { DetectionResult, LatchState } from './types';

export { warmCcld };

/** Below this many normalized characters, detection is a guess — hold instead. */
export const MIN_DETECT_CHARS = 24;

const NEUTRAL: LatchState = {
  detected: false,
  lang: 'unknown',
  tier: 'leaning',
  confidence: 0.5,
  source: 'heuristic',
};

/** Confident-English hysteresis band (the Claudish side uses enter/exit). */
const EN_CONFIDENT_ENTER = 0.3;
const EN_CONFIDENT_EXIT = 0.45;

export function detectClaudish(text: string): DetectionResult {
  try {
    const normalized = normalizeForDetection(text);
    if (normalized.length < MIN_DETECT_CHARS) {
      return { lang: 'unknown', confidence: 0.5, source: 'heuristic' };
    }
    // Register-union ensemble: CCLD learned the AUTHOR'S Claude (which,
    // steered by his own skills, barely says "delve"); the heuristic
    // encodes the STEREOTYPE register visitors type expecting detection.
    // The joke needs both, so detection takes the max — whichever side
    // is more convinced wins and is reported as the source.
    const heuristic = scoreClaudish(text).score;
    const model = getCcldModel();
    let ccld: number | null = null;
    if (model) {
      try {
        const p = model.predict(text);
        if (Number.isFinite(p)) ccld = Math.min(1, Math.max(0, p));
      } catch {
        ccld = null;
      }
    }
    const confidence = ccld === null ? heuristic : Math.max(ccld, heuristic);
    return {
      lang: confidence >= 0.5 ? 'en-x-claudish' : 'en',
      confidence,
      source: ccld !== null && ccld >= heuristic ? 'ccld' : 'heuristic',
    };
  } catch {
    return { lang: 'unknown', confidence: 0.5, source: 'heuristic' };
  }
}

export interface LatchOptions {
  /** Confidence at which "Claudish - detected" turns on. */
  enterThreshold?: number;
  /** Confidence at or below which it turns off again (hysteresis band between). */
  exitThreshold?: number;
  /** Below this input length the latch holds its previous state. */
  minChars?: number;
  /** No flip within this many ms of the previous flip. */
  minDwellMs?: number;
}

export interface DetectionLatch {
  update(text: string, nowMs?: number): LatchState;
  reset(): void;
}

/**
 * Schmitt-trigger latch around detectClaudish. The scorer is injectable for
 * tests; production callers use the default.
 */
export function createDetectionLatch(
  options: LatchOptions = {},
  score: (text: string) => DetectionResult = detectClaudish
): DetectionLatch {
  const enter = options.enterThreshold ?? 0.8;
  const exit = options.exitThreshold ?? 0.55;
  const minChars = options.minChars ?? MIN_DETECT_CHARS;
  const minDwellMs = options.minDwellMs ?? 250;

  let state: LatchState = { ...NEUTRAL };
  let lastFlipAt: number | null = null;
  let enConfident = false;

  return {
    update(text: string, nowMs: number = Date.now()): LatchState {
      const normalized = normalizeForDetection(text);
      if (normalized.length < minChars) {
        return state; // hold — too short to re-decide
      }
      const result = score(text);
      const p = result.confidence;
      const wantDetected = state.detected
        ? p > exit // stay until we cross the exit threshold
        : p >= enter;

      // Confident-English has its own hysteresis band so the label
      // doesn't flap around the 0.30 boundary while typing.
      enConfident = enConfident ? p < EN_CONFIDENT_EXIT : p < EN_CONFIDENT_ENTER;

      // No hedging (user decision): every readable input claims a side.
      const side: LatchState['lang'] = wantDetected || p >= 0.5 ? 'en-x-claudish' : 'en';
      const tier: LatchState['tier'] =
        wantDetected || (side === 'en' && enConfident) ? 'confident' : 'leaning';

      if (wantDetected !== state.detected) {
        const dwellOk = lastFlipAt === null || nowMs - lastFlipAt >= minDwellMs;
        if (!dwellOk) {
          // Refresh confidence but refuse the flip inside the dwell window.
          state = { ...state, confidence: p, source: result.source };
          return state;
        }
        lastFlipAt = nowMs;
      }

      state = {
        detected: wantDetected,
        lang: side,
        tier,
        confidence: p,
        source: result.source,
      };
      return state;
    },
    reset(): void {
      state = { ...NEUTRAL };
      lastFlipAt = null;
      enConfident = false;
    },
  };
}
