'use client';

import { usePathname } from 'next/navigation';

import { AmbientBubbles } from './ambient-bubbles';

/**
 * Route-aware wrapper that only shows ambient bubbles on consulting pages,
 * not on demo pages where they would distract from functional interactions.
 */
export function AmbientBubblesWrapper() {
  const pathname = usePathname();
  const isDemo = pathname.startsWith('/demo');

  if (isDemo) return null;
  return <AmbientBubbles />;
}
