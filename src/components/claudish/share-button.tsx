'use client';

/**
 * Claudish translator — share button.
 *
 * Builds the storage-free share URL via the codec: Web Share sheet when
 * the browser has one (web_share), clipboard copy otherwise (copy_link).
 * When the budget truncated the payload, a one-line excerpt note shows.
 * Analytics carry the URL's LENGTH — the URL is the input text and never
 * enters the data layer.
 */
import { useState } from 'react';

import { encodeShare } from '@/lib/claudish/share-codec';
import { trackClaudishShare } from '@/lib/events/track';

import type { ClaudishDirection } from '@/hooks/useClaudishTranslation';

const ANALYTICS_DIRECTION = {
  en2cl: 'en_to_claudish',
  cl2en: 'claudish_to_en',
} as const;

export function ShareButton({
  source,
  target,
  direction,
}: {
  source: string;
  target: string;
  direction: ClaudishDirection;
}) {
  const [note, setNote] = useState<'copied' | 'excerpt' | null>(null);

  const onShare = async () => {
    const origin = window.location.origin;
    const { url, truncated, urlChars } = encodeShare(
      { direction, source, target },
      { baseUrl: `${origin}/claudish` }
    );
    const fire = (action: 'copy_link' | 'web_share') =>
      trackClaudishShare({
        share_action: action,
        direction: ANALYTICS_DIRECTION[direction],
        output_chars: target.length,
        share_truncated: truncated,
        share_url_chars: urlChars,
      });

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Claudish', url });
        fire('web_share');
        setNote(truncated ? 'excerpt' : null);
        return;
      } catch {
        // Sheet dismissed or unsupported payload: fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      fire('copy_link');
      setNote(truncated ? 'excerpt' : 'copied');
      window.setTimeout(() => setNote(null), 2000);
    } catch {
      // Clipboard denied: nothing to show, nothing broke.
    }
  };

  return (
    <span className="relative inline-flex items-center gap-2">
      <button
        type="button"
        aria-label="Share translation"
        disabled={target.length === 0}
        onClick={onShare}
        className="rounded-full p-2 text-[var(--gt-text-2,#5f6368)] hover:bg-[var(--gt-surface-alt,#f8f9fa)] disabled:opacity-40"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="5.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="18.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="m8.2 10.9 6.6-4M8.2 13.1l6.6 4" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {note === 'copied' ? (
        <span className="text-xs text-[var(--gt-text-3,#80868b)]">Link copied</span>
      ) : null}
      {note === 'excerpt' ? (
        <span className="text-xs text-[var(--gt-text-3,#80868b)]">
          Link copied · long text shares as an excerpt
        </span>
      ) : null}
    </span>
  );
}
