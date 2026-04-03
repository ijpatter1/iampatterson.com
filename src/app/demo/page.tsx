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
    accentClass: 'border-demo-ecommerce/20 hover:border-demo-ecommerce bg-demo-ecommerce-surface',
    dotClass: 'bg-demo-ecommerce',
  },
  {
    href: '/demo/subscription',
    title: 'Tuna Subscription',
    type: 'Subscription',
    description:
      'Trial signups, activations, renewals, churn. See how cohort analysis and LTV calculations are built on the same event infrastructure.',
    accentClass:
      'border-demo-subscription/20 hover:border-demo-subscription bg-demo-subscription-surface',
    dotClass: 'bg-demo-subscription',
  },
  {
    href: '/demo/leadgen',
    title: 'Tuna Partnerships',
    type: 'Lead Generation',
    description:
      'Form submissions, lead qualification, funnel tracking. See how marketing-qualified leads are scored and attributed to acquisition channels.',
    accentClass: 'border-demo-leadgen/20 hover:border-demo-leadgen bg-demo-leadgen-surface',
    dotClass: 'bg-demo-leadgen',
  },
];

export default function DemoLandingPage() {
  return (
    <main className="mx-auto max-w-content px-6 py-16">
      <div className="mb-12 max-w-prose">
        <h1 className="mb-4 font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
          Three business models. One stack. See it all running live.
        </h1>
        <p className="text-lg leading-relaxed text-content-secondary">
          These aren&apos;t mockups. Each demo below is a fully functional front-end generating real
          events that flow through the same measurement infrastructure I build for clients — consent
          management, server-side GTM, BigQuery, Dataform transformations, AI-enriched data models,
          and live dashboards.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-content-secondary">
          Interact with any demo, then flip the card to watch your own session data propagate
          through every layer of the stack in real time.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {demos.map(({ href, title, type, description, accentClass, dotClass }) => (
          <Link
            key={href}
            href={href}
            className={`group rounded-card border p-8 transition-all hover:shadow-elevated ${accentClass}`}
          >
            <div className="mb-4 flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
              <span className="text-xs font-medium uppercase tracking-wider text-content-muted">
                {type}
              </span>
            </div>
            <h2 className="mb-3 text-xl font-semibold text-content group-hover:text-brand-600">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-content-secondary">{description}</p>
            <span className="mt-6 inline-block text-sm font-medium text-content transition-transform group-hover:translate-x-1">
              Explore demo →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
