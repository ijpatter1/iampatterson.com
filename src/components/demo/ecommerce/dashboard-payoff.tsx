'use client';

import { InlineDiagnostic } from '@/components/demo/reveal/inline-diagnostic';
import { METABASE_BASE_URL } from '@/lib/metabase/embed';

/** Fallback dashboard id, mirrors `METABASE_EMBED_CONFIG.dashboardId` when
 * the env isn't wired. Update here + in 9B-infra `metabase-embed-config`
 * Secret Manager entry if the canonical dashboard moves. */
const FALLBACK_DASHBOARD_ID = 2;

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

  return (
    <InlineDiagnostic tag="DASHBOARDS · LIVE" title="here's what your team sees, right now.">
      <div className="w-full">
        <iframe
          src={dashboardUrl}
          title="E-commerce executive dashboard"
          loading="lazy"
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
