import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Ian Patterson builds measurement infrastructure for marketing teams. A decade across marketing, data, and engineering, from both sides of the table.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
