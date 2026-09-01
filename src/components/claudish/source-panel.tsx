'use client';

/**
 * Claudish translator — source panel.
 *
 * Borderless textarea in the Translate idiom; native maxLength enforces
 * the 1,200 cap (pastes truncate at the browser level, matching the
 * counter and the proxy's 413). Clear button appears only with content.
 */
import { INPUT_CAP } from '@/lib/claudish/limits';

import { CharCounter } from './char-counter';
import { LanguageTabRow } from './language-tab-row';

export function SourcePanel({
  value,
  onChange,
  activeTab,
  onTabSelect,
  detection,
}: {
  value: string;
  onChange: (value: string) => void;
  activeTab: number;
  onTabSelect: (index: number) => void;
  detection: { lang: 'en-x-claudish' | 'en'; tier: 'confident' | 'leaning' } | null;
}) {
  return (
    <section
      aria-label="Source text"
      className="flex min-h-[180px] flex-col rounded-lg border border-[var(--gt-border,#dadce0)] bg-[var(--gt-surface,#ffffff)] md:rounded-r-none md:border-r-0"
    >
      <LanguageTabRow
        side="source"
        activeIndex={activeTab}
        onSelect={onTabSelect}
        detection={detection}
      />
      <div className="relative flex flex-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={INPUT_CAP}
          placeholder="Enter text"
          aria-label="Source text"
          className="min-h-[140px] w-full resize-none bg-transparent px-4 py-3 pr-10 text-lg text-[var(--gt-text,#202124)] outline-none placeholder:text-[var(--gt-text-3,#80868b)]"
        />
        {value.length > 0 ? (
          <button
            type="button"
            aria-label="Clear source text"
            onClick={() => onChange('')}
            className="absolute right-2 top-3 rounded-full p-1.5 text-[var(--gt-text-2,#5f6368)] hover:bg-[var(--gt-surface-alt,#f8f9fa)]"
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
