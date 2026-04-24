'use client';

import { useEffect } from 'react';

import { trackWebVital } from '@/lib/events/track';

/**
 * Phase 10 D1: Core Web Vitals reporter.
 *
 * Subscribes to the `web-vitals` library's five CWV callbacks (LCP, CLS,
 * INP, FCP, TTFB) and pushes each final measurement onto the data layer
 * as a `web_vital` event. The library folds intermediate updates
 * (CLS growing, INP increasing) into a single emission on page hide,
 * so we get one event per metric per page visit without per-interaction
 * noise.
 *
 * Renders nothing; mounts once under the root layout client tree. Kept
 * next to `cookiebot-consent.tsx` and `gtm.tsx` in `scripts/` because
 * its role is the same shape: wire a browser-side measurement source
 * into the data layer.
 */

type WebVitalsMetric = {
  name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
  navigationType: string;
};

type WebVitalsReporter = (metric: WebVitalsMetric) => void;

type WebVitalsModule = {
  onLCP: (cb: WebVitalsReporter) => void;
  onCLS: (cb: WebVitalsReporter) => void;
  onINP: (cb: WebVitalsReporter) => void;
  onFCP: (cb: WebVitalsReporter) => void;
  onTTFB: (cb: WebVitalsReporter) => void;
};

function reportMetric(metric: WebVitalsMetric): void {
  // Known limitation (Pass-1 evaluator Tech Minor #5): `trackWebVital` →
  // `baseFields()` reads `window.location.pathname` at emit time. The
  // web-vitals library fires LCP/CLS/INP on `pagehide` /
  // `visibilitychange`, which in Next App Router SPA navigation can
  // fire *after* the pathname has already changed. Real-user LCP data
  // on sessions with SPA nav will report the destination route's
  // pathname rather than the route the metric was measured on. The
  // web-vitals@^5 library supports soft-navigation attribution via a
  // client-side router integration; wiring that is deferred to the
  // carry-forward list alongside the Phase 11 D9 GTM trigger work that
  // has to land before real-user LCP flows to BigQuery.
  trackWebVital({
    metric_name: metric.name,
    metric_value: metric.value,
    metric_rating: metric.rating,
    metric_id: metric.id,
    navigation_type: metric.navigationType,
  });
}

export function WebVitalsReporter() {
  useEffect(() => {
    let cancelled = false;
    // CWV is nice-to-have telemetry; a failed import (CDN hiccup,
    // integrity mismatch, adblock interference) shouldn't surface as an
    // unhandled promise rejection. Swallow silently , the site runs
    // fine without the reporter, it just skips this session's web_vital
    // events.
    import('web-vitals')
      .then((mod: WebVitalsModule) => {
        if (cancelled) return;
        mod.onLCP(reportMetric);
        mod.onCLS(reportMetric);
        mod.onINP(reportMetric);
        mod.onFCP(reportMetric);
        mod.onTTFB(reportMetric);
      })
      .catch(() => {
        // silent , see comment above
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
