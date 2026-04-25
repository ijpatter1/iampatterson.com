'use client';

import Script from 'next/script';

/**
 * Cookiebot CMP loader.
 *
 * `data-blockingmode="manual"` (NOT `"auto"`) per the Phase 1 D3
 * architectural amendment landed during Phase 10d (2026-04-25). Auto mode
 * rewrites <script> tags in <head> during loader execution to gate them by
 * consent — a belt-and-suspenders pattern from before Consent Mode v2 was
 * widely supported. We've fully implemented Consent Mode v2 per-tag
 * (`infrastructure/gtm/web-container.json`: every analytics tag carries
 * `consentSettings: { analytics_storage: required }`), so blockingmode auto
 * is redundant. It also caused a React-19/Next-16 dev hydration mismatch
 * because the DOM rewrite happened before React could hydrate.
 *
 * The explicit gtag('consent', 'update', {...}) bridge that auto-mode used
 * to do implicitly is in `src/lib/events/track.ts` (`bridgeToGtagConsent`),
 * called from both `trackConsentUpdate` (new accept/decline events) and
 * `initConsentState` (returning visitors with stored consent). See
 * `docs/ARCHITECTURE.md` "Cookiebot + GTM Consent Mode" for the full
 * integration sequence and signal mapping.
 */
export function CookiebotScript() {
  const cbid = process.env.NEXT_PUBLIC_COOKIEBOT_ID;
  if (!cbid) return null;

  return (
    <Script
      id="Cookiebot"
      src="https://consent.cookiebot.com/uc.js"
      data-cbid={cbid}
      data-blockingmode="manual"
      type="text/javascript"
      strategy="beforeInteractive"
    />
  );
}
