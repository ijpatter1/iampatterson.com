import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch to discuss your measurement infrastructure needs. I work with e-commerce brands, SaaS companies, marketing agencies, and mobile app companies.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
