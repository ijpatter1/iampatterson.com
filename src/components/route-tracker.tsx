'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { trackPageView } from '@/lib/events/track';

export function RouteTracker() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const referrer = prevPathRef.current ?? document.referrer;
    trackPageView(referrer);
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
