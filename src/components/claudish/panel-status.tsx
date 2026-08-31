/**
 * Claudish translator — verbatim terminal-status lines.
 *
 * Two spec-verbatim strings cover every non-success terminal state:
 * refusal gets its own line; capacity AND generic errors share the
 * boundary line (decision: the page never shows a broken state — the
 * real cause travels in analytics, not the UI).
 */
import { CAPACITY_MESSAGE, REFUSAL_MESSAGE } from '@/lib/claudish/messages';

import type { TranslationStatus } from '@/hooks/useClaudishTranslation';

export function PanelStatus({ status }: { status: TranslationStatus }) {
  if (status !== 'refused' && status !== 'capacity' && status !== 'error') {
    return null;
  }
  const message = status === 'refused' ? REFUSAL_MESSAGE : CAPACITY_MESSAGE;
  return (
    <p role="status" className="text-base text-[var(--gt-text-2,#5f6368)]">
      {message}
    </p>
  );
}
