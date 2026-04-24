'use client';

import { useEffect } from 'react';

import { trackWebVital } from '@/lib/events/track';

/**
 * Phase 10 D1 — Core Web Vitals reporter.
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
    import('web-vitals').then((mod: WebVitalsModule) => {
      if (cancelled) return;
      mod.onLCP(reportMetric);
      mod.onCLS(reportMetric);
      mod.onINP(reportMetric);
      mod.onFCP(reportMetric);
      mod.onTTFB(reportMetric);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
