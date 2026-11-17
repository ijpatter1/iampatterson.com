'use client';

/**
 * Claudish translator — source panel.
 *
 * Borderless textarea in the Translate idiom; native maxLength enforces
 * the 3,000 cap (pastes truncate at the browser level, matching the
 * counter and the proxy's 413). Clear button appears only with content.
 * The textarea grows with its content (grow-wrap below) so the panel
 * expands like the output panel instead of scrolling inside.
 *
 * While the box holds a stored sample, focusing it selects the whole
 * text, so the first keystroke replaces the example instead of adding to
 * it (22.2). The visitor's own text is never selected.
 */
import { useRef } from 'react';

import { INPUT_CAP } from '@/lib/claudish/limits';

import { CharCounter } from './char-counter';
import { FOCUS_RING, ICON_BUTTON } from './control-styles';
import { LanguageTabRow } from './language-tab-row';

export function SourcePanel({
  value,
  onChange,
  activeTab,
  onTabSelect,
  detection,
  holdsSample,
}: {
  value: string;
  onChange: (value: string) => void;
  activeTab: number;
  onTabSelect: (index: number) => void;
  detection: { lang: 'en-x-claudish' | 'en'; tier: 'confident' | 'leaning' } | null;
  /** The box holds a stored sample's exact text (22.2). */
  holdsSample: boolean;
}) {
  // Set by a focus that selected the sample. Some browsers (Safari) place
  // the caret on the mouseup that ends the focusing click, which would
  // undo the selection; that one mouseup keeps its default prevented.
  const selectedOnFocusRef = useRef(false);
  return (
    <section
      aria-label="Source text"
      className="flex min-h-[180px] flex-col rounded-lg border border-[var(--gt-border,#dadce0)] bg-[var(--gt-surface,#ffffff)]"
    >
      <LanguageTabRow
        side="source"
        activeIndex={activeTab}
        onSelect={onTabSelect}
        detection={detection}
      />
      <div className="relative flex flex-1">
        {/* Grow-wrap (Ian, 2026-09-03): an invisible ::after replica of the
            value shares the grid cell with the textarea, so the cell is as
            tall as the text and the textarea stretches to it. Same padding
            and type on both, or the wrap points differ. The trailing space
            keeps a final newline from collapsing. No JS measurement, no
            inline style. */}
        <div
          data-testid="claudish-source-grow"
          data-replicated-value={`${value} `}
          className="grid min-h-[140px] w-full after:invisible after:whitespace-pre-wrap after:break-words after:px-4 after:py-3 after:pr-12 after:text-lg after:content-[attr(data-replicated-value)] after:[grid-area:1/1/2/2]"
        >
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => {
              if (!holdsSample) return;
              e.currentTarget.setSelectionRange(0, e.currentTarget.value.length);
              selectedOnFocusRef.current = true;
            }}
            onMouseUp={(e) => {
              if (selectedOnFocusRef.current) e.preventDefault();
              selectedOnFocusRef.current = false;
            }}
            onBlur={() => {
              selectedOnFocusRef.current = false;
            }}
            maxLength={INPUT_CAP}
            placeholder="Enter text"
            aria-label="Source text"
            className={`w-full resize-none overflow-hidden rounded bg-transparent px-4 py-3 pr-12 text-lg text-[var(--gt-text,#202124)] outline-none [grid-area:1/1/2/2] placeholder:text-[var(--gt-text-3,#80868b)] ${FOCUS_RING} focus-visible:ring-inset`}
          />
        </div>
        {value.length > 0 ? (
          <button
            type="button"
            aria-label="Clear source text"
            onClick={() => onChange('')}
            className={`absolute right-1 top-1 ${ICON_BUTTON}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-end px-4 pb-2">
        <CharCounter text={value} />
      </div>
    </section>
  );
}
