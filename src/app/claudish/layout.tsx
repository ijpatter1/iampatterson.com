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
      {children}
    </div>
  );
}
