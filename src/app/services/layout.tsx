import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Four tiers of measurement infrastructure, from server-side tagging through to attribution modeling. Each one delivers standalone value.',
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
