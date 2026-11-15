'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { trackPageView } from '@/lib/events/track';

/**
 * One page_view per page: the landing page and every client-side navigation.
 * `GA4 - Config` has send_page_view off (page views come from app code), so
 * this is the only source of them. The landing page's referrer is the
 * document's, except on a hard reload, which keeps the original
 * `document.referrer` and would credit that source with a second landing, so
 * it sends ''. A navigation's referrer is the previous path.
 *
 * Until 15.8 the landing page was skipped, on the belief that the config tag
 * sent it, which it does not. A returning visitor's landing page_view carries
 * their stored consent (`applyStoredConsent` in track.ts), and Google's tags
 * already have it from the inline script ahead of GTM.
 */
function isReload(): boolean {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return false;
  }
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return nav?.type === 'reload';
}

export function RouteTracker() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    // Guard against React Strict Mode double-firing
    if (firedRef.current === pathname) return;
    firedRef.current = pathname;

    const referrer = prevPathRef.current ?? (isReload() ? '' : document.referrer);
    trackPageView(referrer);
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
