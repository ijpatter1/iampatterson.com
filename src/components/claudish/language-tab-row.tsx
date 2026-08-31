'use client';

/**
 * Claudish translator — language tab row.
 *
 * A faithful Translate-style tab strip with real tablist semantics
 * (role=tablist / role=tab / aria-selected) — the full-ARIA-tablist
 * pattern the Phase 10d SEO pass deferred site-wide gets its precedent
 * here. While live detection is latched, the source row's Detect tab
 * relabels to the spec-verbatim "Claudish - detected".
 */
import { DETECTED_LABEL, TAB_LABELS } from '@/lib/claudish/messages';

export function LanguageTabRow({
  side,
  activeIndex,
  onSelect,
  detected,
}: {
  side: 'source' | 'target';
  activeIndex: number;
  onSelect: (index: number) => void;
  detected: boolean;
}) {
  const labels: string[] = [...TAB_LABELS[side]];
  if (side === 'source' && detected) {
    labels[0] = DETECTED_LABEL;
  }
  return (
    <div
      role="tablist"
      aria-label={side === 'source' ? 'Source language' : 'Target language'}
      className="flex items-center gap-1 border-b border-[var(--gt-border,#dadce0)] px-2"
    >
      {labels.map((label, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={`${side}-${index}`}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onSelect(index)}
            className={
              'relative px-3 py-3 text-sm font-medium uppercase tracking-wide transition-colors ' +
              (active
                ? 'text-[var(--gt-tab-active,#1a73e8)]'
                : 'text-[var(--gt-text-2,#5f6368)] hover:text-[var(--gt-text,#202124)]')
            }
          >
            {label}
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-[var(--gt-tab-active,#1a73e8)]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
