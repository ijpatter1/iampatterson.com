import Link from 'next/link';

export function LeadgenThankYou() {
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <div className="mb-6 text-4xl">🤝</div>
      <h1 className="mb-4 text-2xl font-bold text-neutral-900">Thanks for your inquiry</h1>
      <p className="text-sm leading-relaxed text-neutral-600">
        In a real implementation, this lead just entered a qualification pipeline — AI-scored,
        categorized by partnership type, and attributed to the channel that brought you here. Look
        under the hood to see the full journey from your first page view to qualified lead.
      </p>
      <Link
        href="/demo/leadgen"
        className="mt-6 inline-block text-sm font-medium text-neutral-900 underline hover:text-neutral-700"
      >
        Back to partnerships
      </Link>
    </div>
  );
}
