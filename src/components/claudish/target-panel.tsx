'use client';

/**
 * Claudish translator — target (output) panel.
 *
 * Streaming choreography: stale output stays visible, dimmed, alongside
 * the cycling spinner verbs until the first new token lands; terminal
 * failure states render the verbatim lines. Accessibility follows the
 * screen-reader plan: aria-busy while streaming (token-by-token
 * announcements would be unusable), with the finished text mirrored
 * once into a visually-hidden polite live region.
 */
import { CLAUDISH_LANG_TAG } from '@/lib/claudish/messages';

import { LanguageTabRow } from './language-tab-row';
import { OutputActions } from './output-actions';
import { PanelStatus } from './panel-status';
import { SpinnerVerbs } from './spinner-verbs';

import type { ClaudishDirection, TranslationStatus } from '@/hooks/useClaudishTranslation';

export function TargetPanel({
  source,
  direction,
  status,
  text,
  staleText,
  hasFirstToken,
  activeTab,
  onTabSelect,
}: {
  source: string;
  direction: ClaudishDirection;
  status: TranslationStatus;
  text: string;
  staleText: string;
  hasFirstToken: boolean;
  ttftMs: number | null;
  cache: 'miss' | 'client' | 'server';
  activeTab: number;
  onTabSelect: (index: number) => void;
}) {
  const streaming = status === 'streaming';
  const waiting = (streaming || status === 'debouncing') && !hasFirstToken;
  const outputLang = direction === 'en2cl' ? CLAUDISH_LANG_TAG : 'en';
  const showPlaceholder = status === 'idle';

  return (
    <section
      aria-label="Translation"
      className="flex min-h-[180px] flex-col rounded-lg border border-[var(--gt-border,#dadce0)] bg-[var(--gt-surface-alt,#f8f9fa)] md:rounded-l-none"
    >
      <LanguageTabRow
        side="target"
        activeIndex={activeTab}
        onSelect={onTabSelect}
        detected={false}
      />
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {showPlaceholder ? (
          <span className="text-lg text-[var(--gt-text-3,#80868b)]">Translation</span>
        ) : null}
        <PanelStatus status={status} />
        {waiting && staleText ? (
          <p
            data-testid="claudish-stale"
            className="whitespace-pre-wrap text-lg text-[var(--gt-text-3,#80868b)] opacity-60"
          >
            {staleText}
          </p>
        ) : null}
        {waiting && status === 'streaming' ? <SpinnerVerbs /> : null}
        {text ? (
          <p
            data-testid="claudish-output"
            lang={outputLang}
            aria-busy={streaming}
            className="whitespace-pre-wrap text-lg text-[var(--gt-text,#202124)]"
          >
            {text}
          </p>
        ) : null}
        {/* Screen readers get the finished translation exactly once. */}
        <span data-testid="claudish-live-mirror" aria-live="polite" className="sr-only">
          {status === 'done' ? text : ''}
        </span>
      </div>
      <OutputActions
        source={source}
        target={status === 'done' ? text : ''}
        direction={direction}
      />
    </section>
  );
}
