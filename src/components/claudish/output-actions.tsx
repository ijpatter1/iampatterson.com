/**
 * Claudish translator — output action row: Copy · Rate · Share.
 */
import { CopyButton } from './copy-button';
import { RateModal } from './rate-modal';
import { ShareButton } from './share-button';

import type { ClaudishDirection } from '@/hooks/useClaudishTranslation';

export function OutputActions({
  source,
  target,
  direction,
}: {
  source: string;
  target: string;
  direction: ClaudishDirection;
}) {
  return (
    <div className="flex items-center justify-end gap-1 px-3 pb-2">
      <CopyButton output={target} direction={direction} />
      <RateModal output={target} direction={direction} />
      <ShareButton source={source} target={target} direction={direction} />
    </div>
  );
}
