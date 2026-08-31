'use client';

/**
 * Claudish translator — swap arrows between the two tab rows.
 * The swap itself (output→input, direction flip) lives in the app
 * orchestrator; this is the affordance.
 */
export function SwapButton({ onSwap }: { onSwap: () => void }) {
  return (
    <button
      type="button"
      aria-label="Swap languages"
      onClick={onSwap}
      className="rounded-full p-2 text-[var(--gt-text-2,#5f6368)] hover:bg-[var(--gt-surface-alt,#f8f9fa)]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 8h11m0 0-3.2-3.2M18 8l-3.2 3.2M17 16H6m0 0 3.2-3.2M6 16l3.2 3.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
