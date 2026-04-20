/**
 * Pipeline bleed-once-per-session flag (F6 UAT close-out).
 *
 * The pipeline section's progressive bleed-through reveal primes the
 * visitor to open the overlay. Once they've opened it once, the section
 * has done its job — repeating the bleed on every subsequent scroll is
 * wallpaper, not signal. This module owns the sessionStorage flag that
 * pipeline-section.tsx reads on mount; when set, the rAF loop and tier
 * state machine are skipped and the section renders in its calm
 * editorial baseline.
 *
 * Scope: session (not localStorage) — a new tab or new browsing session
 * should get another shot at the reveal, on the theory that each visit
 * is a fresh act of consideration for a new visitor or a returning one
 * in a new mindset. Same rationale as NavHint's sessionStorage gate in
 * `src/components/chrome/nav-hint.tsx`.
 */

export const PIPELINE_BLEED_CONSUMED_STORAGE_KEY = 'iampatterson.pipeline_bleed.consumed';

export function hasPipelineBleedConsumed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(PIPELINE_BLEED_CONSUMED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPipelineBleedConsumed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PIPELINE_BLEED_CONSUMED_STORAGE_KEY, '1');
  } catch {
    // Strict-privacy sessionStorage can throw — fall back to letting
    // the bleed re-fire on the next mount.
  }
}
