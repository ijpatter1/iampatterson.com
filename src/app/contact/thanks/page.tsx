import type { Metadata } from 'next';
import Link from 'next/link';

import { BODY_CLASSES, LABEL_CLASSES, PAGE_TITLE_CLASSES } from '@/components/home/section';
import { CONTACT_COPY } from '@/lib/content/contact';

export const metadata: Metadata = {
  title: 'Message sent',
  description: 'Thanks for reaching out. I reply within 24 hours.',
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
