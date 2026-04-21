'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { trackPageView } from '@/lib/events/track';

export function RouteTracker() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const firedRef = useRef<string | null>(null);
  const isInitialRef = useRef(true);

  useEffect(() => {
    // Guard against React Strict Mode double-firing
    if (firedRef.current === pathname) return;
    firedRef.current = pathname;

    // Skip the initial page load, the googtag config tag fires its own
    // page_view on initialization. Only fire for SPA navigations.
    if (isInitialRef.current) {
      isInitialRef.current = false;
      prevPathRef.current = pathname;
      return;
    }

    const referrer = prevPathRef.current ?? document.referrer;
    trackPageView(referrer);
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
