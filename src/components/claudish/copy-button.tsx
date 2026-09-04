'use client';

/**
 * Claudish translator — copy button.
 *
 * Copy is distribution: it fires claudish_share with share_action
 * copy_output (the CtaLocation-style enum fold), carrying only the
 * output LENGTH — never the text. Clipboard failure is silent-safe:
 * no confirmation shown, nothing thrown.
 */
import { useState } from 'react';

import { trackClaudishShare } from '@/lib/events/track';

import type { ClaudishDirection } from '@/hooks/useClaudishTranslation';

const ANALYTICS_DIRECTION = {
  en2cl: 'en_to_claudish',
  cl2en: 'claudish_to_en',
} as const;

export function CopyButton({
  output,
  direction,
}: {
  output: string;
  direction: ClaudishDirection;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      trackClaudishShare({
        share_action: 'copy_output',
        direction: ANALYTICS_DIRECTION[direction],
        output_chars: output.length,
        share_truncated: false,
        share_url_chars: 0,
      });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard denied (permissions, insecure context): stay quiet —
      // the visitor can still select the text by hand.
    }
  };

  return (
    <button
      type="button"
      aria-label="Copy translation"
      disabled={output.length === 0}
      onClick={onCopy}
      className="rounded-full p-2 text-[var(--gt-text-2,#5f6368)] hover:bg-[var(--gt-surface-alt,#f8f9fa)] disabled:opacity-40"
    >
      {copied ? (
        <span className="text-xs">Copied</span>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )}
    </button>
  );
}
