import type { Metadata } from 'next';

const TITLE = 'About';
const DESCRIPTION =
  'Ian Patterson builds measurement infrastructure for marketing teams. A decade across marketing, data, and engineering, from both sides of the table.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://iampatterson.com/about',
    type: 'profile',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: {
    canonical: 'https://iampatterson.com/about',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
