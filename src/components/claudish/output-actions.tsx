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
  fromSample,
}: {
  source: string;
  target: string;
  direction: ClaudishDirection;
  /** The target is a stored sample, not a live translation (22.1). */
  fromSample: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5 px-1.5 pb-1">
      <CopyButton output={target} direction={direction} fromSample={fromSample} />
      <RateModal output={target} direction={direction} fromSample={fromSample} />
      <ShareButton source={source} target={target} direction={direction} fromSample={fromSample} />
    </div>
  );
}
