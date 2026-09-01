/**
 * Claudish translator — shared detection types.
 */

/** BCP-47-ish detection labels. 'unknown' below the minimum input length. */
export type DetectedLang = 'en' | 'en-x-claudish' | 'unknown';

/** Which detector answered: the trained CCLD model or the regex heuristic. */
export type DetectionSource = 'ccld' | 'heuristic';

export interface DetectionResult {
  lang: DetectedLang;
  /** P(claudish) in [0, 1]; 0.5 is neutral. */
  confidence: number;
  source: DetectionSource;
}

/** What the UI renders: the latched (hysteresis-stable) detection state.
 * No hedging (user decision): once input is readable the state always
 * claims a side; `tier` says how loudly. `detected` remains the
 * confident-Claudish flag (latch semantics unchanged). */
export interface LatchState {
  detected: boolean;
  lang: DetectedLang;
  /** 'confident' | 'leaning' — meaningless while lang is 'unknown' (resting). */
  tier: 'confident' | 'leaning';
  confidence: number;
  source: DetectionSource;
}
