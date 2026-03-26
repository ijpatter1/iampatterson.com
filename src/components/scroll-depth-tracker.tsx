'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { trackScrollDepth } from '@/lib/events/track';

const MILESTONES = [25, 50, 75, 100];

export function ScrollDepthTracker() {
  const pathname = usePathname();
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    firedRef.current = new Set();
  }, [pathname]);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const percentage = Math.min(100, Math.round((scrollTop / docHeight) * 100));

      for (const milestone of MILESTONES) {
        if (percentage >= milestone && !firedRef.current.has(milestone)) {
          firedRef.current.add(milestone);
          trackScrollDepth(milestone, Math.round(scrollTop));
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  return null;
}
