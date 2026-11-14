import type { Metadata } from 'next';
import Link from 'next/link';

import { BODY_CLASSES, LABEL_CLASSES, PAGE_TITLE_CLASSES } from '@/components/home/section';
import { CONTACT_COPY, THANKS_METADATA } from '@/lib/content/contact';

const THANKS_URL = 'https://iampatterson.com/contact/thanks';

// Its own title, description, share card and canonical, so nothing inherits
// from /contact's layout; and kept out of search, like robots.ts asks.
export const metadata: Metadata = {
  title: THANKS_METADATA.title,
  description: THANKS_METADATA.description,
  openGraph: {
    title: THANKS_METADATA.title,
    description: THANKS_METADATA.description,
    url: THANKS_URL,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: THANKS_METADATA.title,
    description: THANKS_METADATA.description,
  },
  alternates: { canonical: THANKS_URL },
  robots: { index: false, follow: true },
};

/** After a message is accepted: the same response promise the contact page made. */
export default function ContactThanksPage() {
  return (
    <main className="bg-paper pb-20 pt-8 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <h1 className={PAGE_TITLE_CLASSES}>Message sent.</h1>
        <p className={`mt-8 max-w-[52ch] ${BODY_CLASSES} md:text-lg`}>Thanks for reaching out.</p>
        <p className={`mt-3 max-w-[52ch] ${BODY_CLASSES} md:text-lg`}>{CONTACT_COPY.response}</p>
        <Link
          href="/"
          className={`${LABEL_CLASSES} mt-8 inline-flex min-h-[44px] items-center underline decoration-rule underline-offset-4 transition-colors hover:text-ink`}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
