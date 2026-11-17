'use client';

/**
 * Claudish translator — the "Try one" sample cards (21.3).
 *
 * Each card names its direction and the phrase it puts in the box; the
 * orchestrator shows the stored translation with it, at zero tokens. The
 * card matching what the panels show is aria-pressed, so the page never
 * passes an example off as the visitor's own text.
 */
import { SAMPLE_DIRECTION_LABELS, SAMPLES_HEADING } from '@/lib/claudish/samples';

import { FOCUS_RING } from './control-styles';

import type { ClaudishSample } from '@/lib/claudish/samples';

export function SamplePhrases({
  samples,
  activeIndex,
  onPick,
}: {
  samples: readonly ClaudishSample[];
  activeIndex: number | null;
  onPick: (index: number) => void;
}) {
  return (
    <div>
      <h2
        id="claudish-try-one"
        className="text-sm font-medium tracking-[0.02em] text-[var(--gt-text-2,#5f6368)]"
      >
        {SAMPLES_HEADING}
      </h2>
      <ul
        aria-labelledby="claudish-try-one"
        className="mt-2.5 grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        {samples.map((sample, index) => {
          const pressed = index === activeIndex;
          return (
            <li key={sample.source} className="flex">
              <button
                type="button"
                aria-pressed={pressed}
                onClick={() => onPick(index)}
                className={
                  `min-h-[44px] w-full rounded-lg border px-3.5 py-3 text-left transition-colors ${FOCUS_RING} focus-visible:ring-offset-2 ` +
                  (pressed
                    ? 'border-[var(--gt-tab-active,#1a73e8)] bg-[var(--gt-accent-soft,#e8f0fe)]'
                    : 'border-[var(--gt-border,#dadce0)] bg-[var(--gt-surface,#ffffff)] hover:bg-[var(--gt-surface-alt,#f8f9fa)]')
                }
              >
                <span className="block text-xs font-medium uppercase tracking-[0.04em] text-[var(--gt-text-2,#5f6368)]">
                  {SAMPLE_DIRECTION_LABELS[sample.direction]}
                </span>
                <span className="mt-1.5 block text-[15px] leading-[1.45] text-[var(--gt-text,#202124)]">
                  {sample.source}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
