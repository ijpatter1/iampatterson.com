/**
 * Claudish translator — two-panel surface with the swap arrows between.
 * Side-by-side from md up (Translate's desktop shape), stacked with the
 * swap between panels on mobile.
 */
import { SourcePanel } from './source-panel';
import { SwapButton } from './swap-button';
import { TargetPanel } from './target-panel';

import type { ComponentProps } from 'react';

export function TranslateSurface({
  sourceProps,
  targetProps,
  onSwap,
}: {
  sourceProps: ComponentProps<typeof SourcePanel>;
  targetProps: ComponentProps<typeof TargetPanel>;
  onSwap: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-stretch gap-2 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start md:gap-0">
      <SourcePanel {...sourceProps} />
      <div className="flex justify-center md:pt-2">
        <SwapButton onSwap={onSwap} />
      </div>
      <TargetPanel {...targetProps} />
    </div>
  );
}
