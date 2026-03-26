'use client';

import Script from 'next/script';

export function CookiebotScript() {
  const cbid = process.env.NEXT_PUBLIC_COOKIEBOT_ID;
  if (!cbid) return null;

  return (
    <Script
      id="Cookiebot"
      src="https://consent.cookiebot.com/uc.js"
      data-cbid={cbid}
      data-blockingmode="auto"
      type="text/javascript"
      strategy="afterInteractive"
    />
  );
}
