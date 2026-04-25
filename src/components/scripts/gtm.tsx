'use client';

import Script from 'next/script';

const GTM_CDN = 'https://www.googletagmanager.com';

/**
 * Consent-defaults inline script content. Gtag's denied-by-default state
 * must be installed before `gtm.js` loads so GTM reads the right defaults
 * on init. Rendered as a raw `<script dangerouslySetInnerHTML>` rather
 * than via `next/script` + `beforeInteractive`: the latter produced a
 * React-19/Next-16 hydration mismatch (server-rendered `<script>` tag vs
 * client-rendered `(self.__next_s=…).push(...)` deferred-loader). A
 * plain `<script>` in `<head>` runs during HTML parse, which is before
 * React hydration and before the `gtm-script` block (still on
 * `next/script` + `afterInteractive`, which doesn't warn) bootstraps
 * `gtm.js`. See `cookiebot.tsx` for the same rationale.
 */
const CONSENT_DEFAULTS_INLINE = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  'ad_personalization': 'denied',
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'analytics_storage': 'denied',
  'functionality_storage': 'denied',
  'personalization_storage': 'denied',
  'security_storage': 'granted',
  'wait_for_update': 500
});
gtag('set', 'ads_data_redaction', true);
gtag('set', 'url_passthrough', false);`;

function getGtmScriptUrl(): string {
  // gtm.js is always loaded from Google's CDN. The sGTM handles data
  // transport via server_container_url in the web GTM config tag, not
  // script serving. Stape's custom Data Client proxied gtm.js, but the
  // standard GA4 client does not claim /gtm.js requests.
  return `${GTM_CDN}/gtm.js`;
}

function getNoscriptUrl(gtmId: string): string {
  return `${GTM_CDN}/ns.html?id=${gtmId}`;
}

export function GtmScript() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;

  const scriptUrl = getGtmScriptUrl();

  return (
    <>
      <script
        id="consent-defaults"
        data-cookieconsent="ignore"
        dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULTS_INLINE }}
      />
      <Script id="gtm-script" strategy="afterInteractive" data-cookieconsent="ignore">
        {`
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'${scriptUrl}?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
      </Script>
    </>
  );
}

export function GtmNoscript() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;

  const iframeSrc = getNoscriptUrl(gtmId);

  return (
    <noscript>
      <iframe
        src={iframeSrc}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
