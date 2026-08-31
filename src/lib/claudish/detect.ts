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
  confidence: 0.5,
  source: 'heuristic',
};

export function detectClaudish(text: string): DetectionResult {
  try {
    const normalized = normalizeForDetection(text);
    if (normalized.length < MIN_DETECT_CHARS) {
      return { lang: 'unknown', confidence: 0.5, source: 'heuristic' };
    }
    const model = getCcldModel();
    if (model) {
      try {
        const p = model.predict(text);
        if (Number.isFinite(p)) {
          return {
            lang: p >= 0.5 ? 'en-x-claudish' : 'en',
            confidence: Math.min(1, Math.max(0, p)),
            source: 'ccld',
          };
        }
      } catch {
        // fall through to the heuristic
      }
    }
    const { score } = scoreClaudish(text);
    return {
      lang: score >= 0.5 ? 'en-x-claudish' : 'en',
      confidence: score,
      source: 'heuristic',
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

  return {
    update(text: string, nowMs: number = Date.now()): LatchState {
      const normalized = normalizeForDetection(text);
      if (normalized.length < minChars) {
        return state; // hold — too short to re-decide
      }
      const result = score(text);
      const wantDetected = state.detected
        ? result.confidence > exit // stay until we cross the exit threshold
        : result.confidence >= enter;

      if (wantDetected !== state.detected) {
        const dwellOk = lastFlipAt === null || nowMs - lastFlipAt >= minDwellMs;
        if (!dwellOk) {
          // Refresh confidence but refuse the flip inside the dwell window.
          state = { ...state, confidence: result.confidence, source: result.source };
          return state;
        }
        lastFlipAt = nowMs;
        state = {
          detected: wantDetected,
          lang: result.lang,
          confidence: result.confidence,
          source: result.source,
        };
        return state;
      }

      state = {
        detected: state.detected,
        lang: state.detected ? 'en-x-claudish' : result.lang,
        confidence: result.confidence,
        source: result.source,
      };
      return state;
    },
    reset(): void {
      state = { ...NEUTRAL };
      lastFlipAt = null;
    },
  };
}
