'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { trackPageView } from '@/lib/events/track';

export function RouteTracker() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    // Guard against React Strict Mode double-firing
    if (firedRef.current === pathname) return;
    firedRef.current = pathname;

    const referrer = prevPathRef.current ?? document.referrer;
    trackPageView(referrer);
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
