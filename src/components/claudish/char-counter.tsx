/**
 * Claudish translator — character counter.
 *
 * Google Translate's counter format with the joke's own tail:
 * "412 / 3,000 · 9 em dashes". Shows the real enforced cap (user
 * decision — displaying 5,000 while truncating at 3,000 is the kind of
 * detail that gets screenshotted). The em-dash tail only appears once
 * there is at least one.
 */
import { INPUT_CAP } from '@/lib/claudish/limits';
import { countChars, countEmDashes } from '@/lib/claudish/text-stats';

export function CharCounter({ text }: { text: string }) {
  const chars = countChars(text);
  const emDashes = countEmDashes(text);
  const base = `${chars.toLocaleString('en-US')} / ${INPUT_CAP.toLocaleString('en-US')}`;
  const tail =
    emDashes === 0 ? '' : ` · ${emDashes.toLocaleString('en-US')} em dash${emDashes === 1 ? '' : 'es'}`;
  return (
    <span className="text-xs text-[var(--gt-text-3,#80868b)]" data-testid="claudish-char-counter">
      {base}
      {tail}
    </span>
  );
}
