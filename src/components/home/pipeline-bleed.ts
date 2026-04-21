/**
 * Pure ramp-math + tier classification for the Phase 9E D5 progressive
 * bleed-through reveal on the homepage pipeline section.
 *
 * Extracted from the design-handoff prototype's inline JS so the math can
 * be unit-tested without a DOM. The component shell calls `computeBleed`
 * each frame from a `requestAnimationFrame` loop, writes the result to
 * `--bleed` on the section element, and re-renders React only when
 * `tierFor(bleed)` crosses a threshold.
 *
 * Reference: docs/input_artifacts/design_handoff_pipeline/README.md
 *   §"Bleed ramp math (the load-bearing bit)"
 */

/**
 * Compute the 0..1 bleed value for a given scroll position.
 *
 * The ramp anchors to the section's *own* height, not a viewport
 * fraction. If it tracked viewport scroll distance instead, the amber
 * peaks before the reader's finished and the entire reveal dies.
 *
 *   enter = vh * 0.25       (top of section is a quarter down the viewport)
 *   peak  = vh * 0.95 - h   (bottom of section is near viewport bottom)
 *   p     = 1 - clamp((rectTop - peak) / span, 0, 1)
 *   bleed = p * p           (ease-in: stays calm early, lands amber late)
 *
 * Out-of-view (rect.bottom < -200 or rectTop > vh + 200) returns 0 to
 * skip math when the section can't be seen.
 *
 * @param rectTop  Section's `getBoundingClientRect().top` (px from viewport top).
 * @param vh       `window.innerHeight` (must be > 0).
 * @param h        Section's `offsetHeight` (must be > 0).
 */
export function computeBleed(rectTop: number, vh: number, h: number): number {
  // Out-of-view short-circuit. rect.bottom = rectTop + h.
  const rectBottom = rectTop + h;
  if (rectBottom < -200 || rectTop > vh + 200) return 0;

  const enter = vh * 0.25;
  const peak = vh * 0.95 - h;
  const span = Math.max(1, enter - peak);
  const raw = (rectTop - peak) / span;
  const clamped = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  const p = 1 - clamped;
  return p * p;
}

/** Tier integers matching the prototype's class state machine. */
export const BLEED_TIER = Object.freeze({
  calm: 0,
  warm: 1,
  hot: 2,
  peak: 3,
} as const);

export type BleedTier = (typeof BLEED_TIER)[keyof typeof BLEED_TIER];

/**
 * Map a bleed value to its discrete tier. Thresholds match the design
 * handoff: warm > 0.18, hot > 0.55, peak > 0.85. Strict-greater-than is
 * intentional, at exactly 0.18 you're still calm, etc., so that
 * floating-point boundary jitter doesn't flicker the class.
 */
export function tierFor(bleed: number): BleedTier {
  if (bleed > 0.85) return BLEED_TIER.peak;
  if (bleed > 0.55) return BLEED_TIER.hot;
  if (bleed > 0.18) return BLEED_TIER.warm;
  return BLEED_TIER.calm;
}

/**
 * Map a tier to the section className suffix used by the CSS state
 * machine. Matches the prototype's `peak hot` / `hot` / `warm` / `''`.
 */
export function tierClassName(tier: BleedTier): string {
  if (tier === BLEED_TIER.peak) return 'peak hot';
  if (tier === BLEED_TIER.hot) return 'hot';
  if (tier === BLEED_TIER.warm) return 'warm';
  return '';
}
