import type { Metadata } from 'next';

import { EcomProviders } from '@/components/demo/ecommerce/ecom-providers';

const TITLE = 'The Tuna Shop — Live Ecommerce Demo';
const DESCRIPTION =
  'A working ecommerce demo wired through the same measurement stack the rest of the site runs on. Browse the catalog, add to cart, complete checkout — every interaction lands in BigQuery in real time.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://iampatterson.com/demo/ecommerce',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: {
    canonical: 'https://iampatterson.com/demo/ecommerce',
  },
};

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  // `data-demo="ecommerce"` scopes the Tuna Shop palette override in
  // `src/styles/globals.css`. The shop's terracotta `--accent` replaces
  // the site-wide persimmon inside this subtree only — see
  // `docs/REQUIREMENTS.md` Phase 9F deliverable 12 +
  // `docs/ARCHITECTURE.md` "Brand treatment".
  return <EcomProviders>{children}</EcomProviders>;
}
