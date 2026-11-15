import type { Metadata } from 'next';

import { CONTACT_METADATA } from '@/lib/content/contact';

const TITLE = CONTACT_METADATA.title;
const DESCRIPTION = CONTACT_METADATA.description;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://iampatterson.com/contact',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: {
    canonical: 'https://iampatterson.com/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
