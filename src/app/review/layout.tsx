import type { Metadata } from 'next';

import { REVIEW_PRICE } from '@/lib/content/review';

const TITLE = 'Start with a review';
const DESCRIPTION = `A paid, read-only review of your tracking and each ad platform's claims against your orders, with findings ranked by impact. From ${REVIEW_PRICE}.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://iampatterson.com/review',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: {
    canonical: 'https://iampatterson.com/review',
  },
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
