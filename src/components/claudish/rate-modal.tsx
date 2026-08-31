'use client';

/**
 * Claudish translator — rate button + in-place mini modal.
 *
 * The two thumbs carry the joke's best labels, spec-verbatim:
 * "Holds up." (👍) and "You're absolutely right." (👎 — because that is
 * what Claude says when told it's wrong). Picking one fires
 * claudish_rate and closes; Escape closes silently.
 */
import { useEffect, useRef, useState } from 'react';

import { RATE_DOWN_LABEL, RATE_UP_LABEL } from '@/lib/claudish/messages';
import { trackClaudishRate } from '@/lib/events/track';

import type { ClaudishDirection } from '@/hooks/useClaudishTranslation';

const ANALYTICS_DIRECTION = {
  en2cl: 'en_to_claudish',
  cl2en: 'claudish_to_en',
} as const;

export function RateModal({
  output,
  direction,
}: {
  output: string;
  direction: ClaudishDirection;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the modal so keyboard users land on the first thumb.
    dialogRef.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const rate = (rating: 'holds_up' | 'absolutely_right') => {
    trackClaudishRate({
      rating,
      direction: ANALYTICS_DIRECTION[direction],
      output_chars: output.length,
    });
    setOpen(false);
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Rate translation"
        disabled={output.length === 0}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-2 text-[var(--gt-text-2,#5f6368)] hover:bg-[var(--gt-surface-alt,#f8f9fa)] disabled:opacity-40"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 2 2v4h5.2a1.8 1.8 0 0 1 1.77 2.12l-1.2 6.5A1.8 1.8 0 0 1 17 19.1H7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Rate this translation"
          className="absolute bottom-full right-0 z-10 mb-2 w-max rounded-lg border border-[var(--gt-border,#dadce0)] bg-[var(--gt-surface,#ffffff)] p-2 shadow-md"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => rate('holds_up')}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--gt-text,#202124)] hover:bg-[var(--gt-accent-soft,#e8f0fe)]"
            >
              <span aria-hidden="true">👍 </span>
              {RATE_UP_LABEL}
            </button>
            <button
              type="button"
              onClick={() => rate('absolutely_right')}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--gt-text,#202124)] hover:bg-[var(--gt-accent-soft,#e8f0fe)]"
            >
              <span aria-hidden="true">👎 </span>
              {RATE_DOWN_LABEL}
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
