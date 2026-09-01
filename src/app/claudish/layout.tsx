import { robotoClone } from '@/lib/claudish/fonts';

import type { Metadata } from 'next';

const TITLE = 'Claudish Translate';
const DESCRIPTION =
  "Translate both directions between English and Claudish, the em-dash-rich register of Claude's prose. A toy by Ian Patterson.";

/**
 * Static metadata for /claudish. The title is ABSOLUTE: the root
 * template's " | Patterson Consulting" suffix would read wrong on a
 * Translate spoof, in the tab and in every unfurl. The canonical is
 * always the bare route so the unbounded ?t= share space collapses to
 * one indexable URL. page.tsx layers the dynamic OG card on top when a
 * valid share param is present.
 */
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://iampatterson.com/claudish',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  alternates: { canonical: 'https://iampatterson.com/claudish' },
};

/**
 * Parse-time privacy strip: the ?t= share payload IS the visitor's input
 * text. This inline script executes while the body is still parsing —
 * before the async gtag.js library can load, before its config page_view
 * fires, and before any link is clickable — so neither GA4's dl nor a
 * later navigation's referrer ever sees the payload. It must stay a
 * plain inline <script> (next/script beforeInteractive is not allowed in
 * nested layouts; afterInteractive would race GTM). history.state is
 * preserved; only the t param is stripped. Server-side reads
 * (generateMetadata + the shareParam prop) see the original request URL
 * and are unaffected. Known tradeoff: a hard reload after the strip
 * loses the shared translation — accepted; the share still landed.
 */
const STRIP_SHARE_PARAM_JS = `(function(){try{var u=new URL(location.href);if(u.searchParams.has('t')){u.searchParams.delete('t');var q=u.searchParams.toString();history.replaceState(history.state,'',u.pathname+(q?'?'+q:'')+u.hash);}}catch(e){}})();`;

export default function ClaudishLayout({ children }: { children: React.ReactNode }) {
  // data-skin drives the trade-dress palette in globals.css; flipping the
  // env var to 'personal' is the takedown re-skin (no code change).
  const skin = process.env.NEXT_PUBLIC_CLAUDISH_SKIN === 'personal' ? 'personal' : 'clone';
  return (
    <div
      data-page="claudish"
      data-skin={skin}
      className={`${robotoClone.variable} flex min-h-screen flex-col`}
    >
      <script dangerouslySetInnerHTML={{ __html: STRIP_SHARE_PARAM_JS }} />
      {children}
    </div>
  );
}
