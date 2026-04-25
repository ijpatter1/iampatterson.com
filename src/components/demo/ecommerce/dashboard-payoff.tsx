'use client';

import { useEffect, useState } from 'react';

import { InlineDiagnostic } from '@/components/demo/reveal/inline-diagnostic';
import { METABASE_BASE_URL } from '@/lib/metabase/embed';

/** Fallback dashboard id, mirrors `METABASE_EMBED_CONFIG.dashboardId` when
 * the env isn't wired. Update here + in 9B-infra `metabase-embed-config`
 * Secret Manager entry if the canonical dashboard moves. */
const FALLBACK_DASHBOARD_ID = 2;

/** Phase 10d D2: load-timeout budget for the Metabase iframe. 15s sits
 * well under the ~60s JVM cold-start envelope documented in 9B follow-up
 * #1 (`cpu-throttling=true`) but is long enough that a typical warm load
 * — single-digit seconds — clears the timer cleanly. If the Cloud Run
 * service is later switched to `--no-cpu-throttling`, drop this to 8-10s.
 * See docs/perf/error-handling-audit-2026-04-25.md path B. */
const IFRAME_LOAD_TIMEOUT_MS = 15_000;

/**
 * Phase 9F D9, Tier 3 dashboard payoff surface.
 *
 * Wraps a single full-dashboard Metabase embed in `InlineDiagnostic` so
 * the Tier 3 payoff reads visually continuous with the rest of the demo's
 * reveal aesthetic (amber headers, terminal-style separators). Renders a
 * visible IAP-gated deep-link on mobile as an honest "here's where this
 * lives in production" affordance.
 *
 * The lead paragraph lives OUTSIDE this component, `ConfirmationView`
 * owns the editorial prose so the $total interpolation is one concern,
 * and this component is purely the embed chrome.
 */
export function DashboardPayoff({
  dashboardUrl,
  dashboardId = FALLBACK_DASHBOARD_ID,
}: {
  dashboardUrl: string | null;
  /** Threaded from `METABASE_EMBED_CONFIG.dashboardId` at the page
   * boundary so the canonical deep-link + fallback text track the env
   * contract. Defaults to the pinned fallback when not supplied. */
  dashboardId?: number;
}) {
  const deepLinkUrl = `${METABASE_BASE_URL}/dashboard/${dashboardId}`;
  // Phase 10d D2: track whether the iframe has fired onLoad and whether
  // the load-timeout budget elapsed without a load. Two independent flags
  // because the timer schedule depends on neither having fired yet, and
  // the fallback-render branch depends specifically on the timeout side.
  const [loaded, setLoaded] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  // Schedule the load-timeout only when an iframe is actually mounted (URL
  // is non-null AND we haven't already loaded or timed out). The dependency
  // array drives re-evaluation when any of those three change; cleanup
  // clears any pending timer to keep the budget honest across re-renders.
  useEffect(() => {
    if (!dashboardUrl || loaded || loadTimedOut) return;
    const timer = setTimeout(() => setLoadTimedOut(true), IFRAME_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [dashboardUrl, loaded, loadTimedOut]);

  if (!dashboardUrl) {
    return (
      <InlineDiagnostic
        tag="DASHBOARDS · LIVE"
        title="dashboard embeds disabled in this environment"
      >
        <p className="text-[13px] leading-relaxed text-[#EAD9BC]/80">
          The signing env vars aren&apos;t wired in this environment. The dashboard lives at{' '}
          <a
            href={deepLinkUrl}
            className="underline decoration-[#F3C769]/60 underline-offset-2 hover:text-[#F3C769]"
            target="_blank"
            rel="noreferrer"
          >
            bi.iampatterson.com/dashboard/{dashboardId}
          </a>{' '}
          behind Google SSO.
        </p>
      </InlineDiagnostic>
    );
  }

  if (loadTimedOut) {
    return (
      <InlineDiagnostic tag="DASHBOARDS · LIVE" title="dashboard didn't load in time">
        <p className="text-[13px] leading-relaxed text-[#EAD9BC]/80">
          The Metabase instance may be in cold-start. The dashboard lives at{' '}
          <a
            href={deepLinkUrl}
            className="underline decoration-[#F3C769]/60 underline-offset-2 hover:text-[#F3C769]"
            target="_blank"
            rel="noreferrer"
          >
            bi.iampatterson.com/dashboard/{dashboardId}
          </a>{' '}
          behind Google SSO — open it directly to see the same view that would have rendered here.
        </p>
      </InlineDiagnostic>
    );
  }

  return (
    <InlineDiagnostic tag="DASHBOARDS · LIVE" title="here's what your team sees, right now.">
      <div className="w-full">
        <iframe
          src={dashboardUrl}
          title="E-commerce executive dashboard"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className="block h-[1400px] w-full rounded border-0 bg-white md:h-[1100px]"
          allow="fullscreen"
        />
      </div>
      <p className="mt-2 text-[11px] text-[#EAD9BC]/60 md:hidden">
        <a
          href={deepLinkUrl}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-[#F3C769]/60 underline-offset-2 hover:text-[#F3C769]"
        >
          view full dashboard → (Google SSO required · internal BI)
        </a>
      </p>
    </InlineDiagnostic>
  );
}
