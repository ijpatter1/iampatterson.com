'use client';

import { usePathname } from 'next/navigation';

import { showAmbientBubbles } from '@/lib/chrome/suppression';

import { AmbientBubbles } from './ambient-bubbles';

/**
 * Route-aware wrapper that only shows ambient bubbles on consulting pages,
 * not on demo pages (functional interactions) or /claudish (the clone).
 */
export function AmbientBubblesWrapper() {
  const pathname = usePathname();
  if (!showAmbientBubbles(pathname)) return null;
  return <AmbientBubbles />;
}
