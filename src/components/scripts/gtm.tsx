'use client';

import Script from 'next/script';

function getHost(sgtmUrl?: string): string {
  if (!sgtmUrl) return 'https://www.googletagmanager.com';
  const cleaned = sgtmUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${cleaned}`;
}

function getGtmScriptUrl(sgtmUrl?: string): string {
  return `${getHost(sgtmUrl)}/gtm.js`;
}

function getNoscriptUrl(gtmId: string, sgtmUrl?: string): string {
  return `${getHost(sgtmUrl)}/ns.html?id=${gtmId}`;
}

export function GtmScript() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const sgtmUrl = process.env.NEXT_PUBLIC_SGTM_URL;
  if (!gtmId) return null;

  const scriptUrl = getGtmScriptUrl(sgtmUrl);

  return (
    <>
      <Script id="consent-defaults" strategy="beforeInteractive" data-cookieconsent="ignore">
        {`
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
gtag('set', 'url_passthrough', false);`}
      </Script>
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
  const sgtmUrl = process.env.NEXT_PUBLIC_SGTM_URL;
  if (!gtmId) return null;

  const iframeSrc = getNoscriptUrl(gtmId, sgtmUrl);

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
