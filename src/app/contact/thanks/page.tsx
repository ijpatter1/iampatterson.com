import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Message sent',
  description: 'Thanks for reaching out. I will respond within 24 hours.',
};

export default function ContactThanksPage() {
  return (
    <main className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Message sent.</h1>
        <div className="mt-6 space-y-4 text-neutral-700">
          <p>
            Thanks for reaching out. I&#39;ll respond within 24 hours. If we&#39;re a good fit,
            we&#39;ll schedule a 30-minute call to discuss your current setup and goals.
          </p>
        </div>
        <div className="mt-8">
          <Link
            href="/"
            className="text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
