import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Demos',
  description:
    'Three fully functional demos showing the measurement stack applied to e-commerce, subscription, and lead generation.',
};

const demos = [
  {
    href: '/demo/ecommerce',
    title: 'The Tuna Shop',
    type: 'E-Commerce',
    description:
      'Product views, add to cart, checkout, purchase tracking. See how purchase events flow from click to warehouse to attribution model.',
  },
  {
    href: '/demo/subscription',
    title: 'Tuna Subscription',
    type: 'Subscription',
    description:
      'Trial signups, activations, renewals, churn. See how cohort analysis and LTV calculations are built on the same event infrastructure.',
  },
  {
    href: '/demo/leadgen',
    title: 'Tuna Partnerships',
    type: 'Lead Generation',
    description:
      'Form submissions, lead qualification, funnel tracking. See how marketing-qualified leads are scored and attributed to acquisition channels.',
  },
];

export default function DemoLandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Three business models. One stack. See it all running live.
        </h1>
        <p className="text-lg leading-relaxed text-neutral-600">
          These aren&apos;t mockups. Each demo below is a fully functional front-end generating real
          events that flow through the same measurement infrastructure I build for clients — consent
          management, server-side GTM, BigQuery, Dataform transformations, AI-enriched data models,
          and live dashboards.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-neutral-600">
          Interact with any demo, then flip the card to watch your own session data propagate
          through every layer of the stack in real time.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {demos.map(({ href, title, type, description }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border border-neutral-200 p-6 transition-all hover:border-neutral-400 hover:shadow-md"
          >
            <span className="mb-2 inline-block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {type}
            </span>
            <h2 className="mb-3 text-xl font-semibold text-neutral-900 group-hover:text-neutral-700">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-600">{description}</p>
            <span className="mt-4 inline-block text-sm font-medium text-neutral-900 group-hover:underline">
              Explore demo &rarr;
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
