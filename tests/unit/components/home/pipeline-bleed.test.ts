/**
 * Pure ramp-math + tier-classifier tests for the Phase 9E D5 progressive
 * bleed-through reveal. Extracted from `src/components/home/pipeline-bleed.ts`
 * so the math can be exercised without a DOM.
 *
 * Reference math (docs/input_artifacts/design_handoff_pipeline/README.md):
 *
 *   const enter = vh * 0.25;
 *   const peak  = vh * 0.95 - h;
 *   const span  = Math.max(1, enter - peak);
 *   const p     = 1 - clamp((rectTop - peak) / span, 0, 1);
 *   const bleed = p * p;             // ease-in
 *
 * Anchoring the ramp to the section's *own* height (not a viewport
 * fraction) is load-bearing — if it tracks viewport scroll, the amber
 * peaks before the reader's finished and the entire reveal dies.
 */

import { computeBleed, tierFor, BLEED_TIER } from '@/components/home/pipeline-bleed';

describe('computeBleed (pure ramp math)', () => {
  // Use a section taller than the viewport so the ramp has room to breathe.
  const VH = 800;
  const H = 1600;

  it('returns 0 when the section is fully below the viewport', () => {
    // rectTop > vh + 200 → out-of-view zero
    expect(computeBleed(VH + 400, VH, H)).toBe(0);
  });

  it('returns 0 when the section has scrolled fully above the viewport', () => {
    // rect.bottom < -200 → out-of-view zero. rect.bottom = rectTop + h.
    expect(computeBleed(-H - 400, VH, H)).toBe(0);
  });

  it('returns 0 at the entry threshold (rectTop === vh * 0.25)', () => {
    // p === 0 at the entry threshold → bleed = 0² = 0.
    expect(computeBleed(VH * 0.25, VH, H)).toBe(0);
  });

  it('returns ~1 at the peak threshold (rectTop === vh * 0.95 - h)', () => {
    const rectTop = VH * 0.95 - H;
    expect(computeBleed(rectTop, VH, H)).toBeCloseTo(1, 5);
  });

  it('applies a p² ease-in (slower start than linear)', () => {
    const enter = VH * 0.25;
    const peak = VH * 0.95 - H;
    const span = enter - peak;
    // Halfway through the ramp (linearly): p = 0.5 → bleed = 0.25.
    const halfway = enter - span * 0.5;
    expect(computeBleed(halfway, VH, H)).toBeCloseTo(0.25, 5);
  });

  it('clamps below the entry threshold', () => {
    // rectTop > enter but still in-view (within +200 grace) → still 0.
    expect(computeBleed(VH * 0.5, VH, H)).toBe(0);
  });

  it('clamps above the peak threshold', () => {
    // rectTop < peak but still in-view (within -200 grace) → still 1.
    const rectTop = VH * 0.95 - H - 100;
    expect(computeBleed(rectTop, VH, H)).toBe(1);
  });

  it('handles a section shorter than the viewport without dividing by zero', () => {
    // Short section: enter (vh * 0.25) is now LESS than peak (vh * 0.95 - h),
    // so the ramp window collapses. Math.max(1, enter - peak) guards against
    // divide-by-zero. The honest behavior here is "always at peak" (the
    // section's bottom is already past the peak threshold the moment its
    // top enters) — the homepage pipeline section is substantial enough
    // that this never happens in practice, but we confirm the function
    // doesn't crash and stays in [0, 1].
    const shortH = 400;
    for (let t = -shortH; t <= VH; t += 50) {
      const b = computeBleed(t, VH, shortH);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
      expect(Number.isFinite(b)).toBe(true);
    }
  });

  it('returns a value in [0, 1] for any in-view rectTop', () => {
    for (let t = -H; t <= VH; t += 20) {
      const b = computeBleed(t, VH, H);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });
});

describe('tierFor (bleed → tier integer)', () => {
  it('returns BLEED_TIER.calm below 0.18', () => {
    expect(tierFor(0)).toBe(BLEED_TIER.calm);
    expect(tierFor(0.17)).toBe(BLEED_TIER.calm);
    expect(tierFor(0.179)).toBe(BLEED_TIER.calm);
  });

  it('returns BLEED_TIER.warm in (0.18, 0.55]', () => {
    expect(tierFor(0.181)).toBe(BLEED_TIER.warm);
    expect(tierFor(0.4)).toBe(BLEED_TIER.warm);
    expect(tierFor(0.55)).toBe(BLEED_TIER.warm);
  });

  it('returns BLEED_TIER.hot in (0.55, 0.85]', () => {
    expect(tierFor(0.551)).toBe(BLEED_TIER.hot);
    expect(tierFor(0.7)).toBe(BLEED_TIER.hot);
    expect(tierFor(0.85)).toBe(BLEED_TIER.hot);
  });

  it('returns BLEED_TIER.peak above 0.85', () => {
    expect(tierFor(0.851)).toBe(BLEED_TIER.peak);
    expect(tierFor(0.95)).toBe(BLEED_TIER.peak);
    expect(tierFor(1)).toBe(BLEED_TIER.peak);
  });

  it('orders the tiers calm < warm < hot < peak', () => {
    expect(BLEED_TIER.calm).toBeLessThan(BLEED_TIER.warm);
    expect(BLEED_TIER.warm).toBeLessThan(BLEED_TIER.hot);
    expect(BLEED_TIER.hot).toBeLessThan(BLEED_TIER.peak);
  });
});
