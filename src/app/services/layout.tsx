import type { Metadata } from 'next';

const TITLE = 'Services';
const DESCRIPTION =
  'Four tiers of measurement infrastructure, from server-side tagging through to attribution modeling.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://iampatterson.com/services',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: {
    canonical: 'https://iampatterson.com/services',
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
