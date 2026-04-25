'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { trackPageEngagement } from '@/lib/events/track';

/**
 * Phase 10d D3: page-level engagement tracker.
 *
 * Fires `page_engagement` at 15s, 60s, 180s of *engaged* time on a page.
 * Engaged time advances at 1Hz when `document.hidden === false`; the
 * counter pauses on visibilitychange→hidden and resumes on
 * visibilitychange→visible. Each threshold fires at most once per
 * pathname; SPA route changes reset the fired set via the `pathname`
 * effect dep.
 *
 * Mounted next to `RouteTracker` + `ScrollDepthTracker` in the root
 * layout, so engagement is measured on every page in the site.
 *
 * `max_scroll_pct` rides along on each emission as the high-water-mark
 * scroll percentage at the moment of firing — the unbucketed counterpart
 * to `scroll_depth`'s milestone-only signal.
 */
const ENGAGEMENT_THRESHOLDS_SEC = [15, 60, 180] as const;

export function PageEngagementTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let engagedSeconds = 0;
    let maxScrollPct = 0;
    let isVisible = !document.hidden;
    const fired = new Set<number>();

    function updateMaxScroll() {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / docHeight) * 100));
      if (pct > maxScrollPct) maxScrollPct = pct;
    }

    function tick() {
      if (!isVisible) return;
      engagedSeconds++;
      for (const threshold of ENGAGEMENT_THRESHOLDS_SEC) {
        if (engagedSeconds >= threshold && !fired.has(threshold)) {
          fired.add(threshold);
          trackPageEngagement({
            engagement_seconds: threshold,
            max_scroll_pct: maxScrollPct,
          });
        }
      }
    }

    function handleVisibility() {
      isVisible = !document.hidden;
    }

    function handleScroll() {
      updateMaxScroll();
    }

    updateMaxScroll();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  return null;
}
