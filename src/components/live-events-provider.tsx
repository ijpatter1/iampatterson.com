'use client';

import type { ReactNode } from 'react';

import { useAnalyticsConsent } from '@/hooks/useAnalyticsConsent';
import { LiveEventsContext, useLiveEventsSource } from '@/hooks/useLiveEvents';

/**
 * Opens the page's single live event source and shares it.
 *
 * Consent is resolved before the source is chosen: a visitor who declined is
 * pinned to the data layer, so they see their own events marked blocked rather
 * than the single consent_update that is all the stream can offer them.
 *
 * Mount once, inside `SessionStateProvider`. This is the only place the
 * source may be opened; `tests/unit/hooks/live-events-wiring.test.ts` pins it.
 */
export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const analyticsConsent = useAnalyticsConsent();
  const value = useLiveEventsSource({ analyticsConsent });
  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}
