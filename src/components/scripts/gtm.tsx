'use client';

import Script from 'next/script';

function getHost(sgtmUrl?: string): string {
  return sgtmUrl ? `https://${sgtmUrl}` : 'https://www.googletagmanager.com';
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
      <Script id="consent-defaults" strategy="beforeInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'functionality_storage': 'denied',
  'wait_for_update': 500
});`}
      </Script>
      <Script id="gtm-script" strategy="afterInteractive">
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
