'use client';

import { CtaLink } from '@/components/cta-link';
import { useOverlay } from '@/components/overlay/overlay-context';
import { ScrollReveal } from '@/components/scroll-reveal';
import { trackClickCta } from '@/lib/events/track';

const demos = [
  {
    href: '/demo/ecommerce',
    title: 'The Tuna Shop',
    type: 'E-Commerce',
    description:
      'A fully instrumented e-commerce storefront. Browse products, add to cart, and complete checkout. Every interaction generates events that flow through the full measurement stack.',
    highlights: [
      'Campaign taxonomy classifies your UTM parameters with AI',
      'Data quality assertions validate every event in real time',
      'Revenue attribution compares Shapley value vs last-click',
    ],
  },
  {
    href: '/demo/subscription',
    title: 'Tuna Subscription',
    type: 'Subscription',
    description:
      'A subscription product from signup to retention. Select a plan, start a trial, and explore the account dashboard to see how cohort analysis and LTV calculations work on the same event infrastructure.',
    highlights: [
      'Cohort retention curves segmented by acquisition channel',
      'LTV analysis reveals which channels produce lasting subscribers',
      'Multi-touch attribution redistributes credit across the funnel',
    ],
  },
  {
    href: '/demo/leadgen',
    title: 'Tuna Partnerships',
    type: 'Lead Generation',
    description:
      'A lead generation landing page with full funnel tracking. Fill out the partnership inquiry form and watch consent enforcement, PII handling, and lead qualification happen in real time.',
    highlights: [
      'Live consent enforcement: deny marketing consent and watch routing change',
      'AI-powered lead scoring classifies inquiries automatically',
      'Automated narrative reporting summarizes pipeline performance weekly',
    ],
  },
];

export default function HomePage() {
  const { open } = useOverlay();

  return (
    <main>
      {/* Hero */}
      <section className="relative flex min-h-[90vh] items-center bg-surface-dark px-6">
        <div className="section-container">
          <ScrollReveal variant="fade" duration={0.8}>
            <h1 className="max-w-4xl font-display text-3xl font-bold tracking-tight text-content-inverse sm:text-display-lg lg:text-display-xl">
              I build measurement infrastructure for marketing teams.
            </h1>
          </ScrollReveal>
          <ScrollReveal variant="slideUp" delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-content-on-dark sm:text-xl">
              This site runs on the same stack I sell. Consent management, server-side GTM, a
              real-time event pipeline into BigQuery, Dataform transformations, AI-enriched data
              models, and live dashboards. All running right now, on your session. Instead of
              describing what I build, I built this site on it.
            </p>
          </ScrollReveal>
          <ScrollReveal variant="slideUp" delay={0.5}>
            <div className="mt-10 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => {
                  trackClickCta('Look under the hood', 'hero');
                  open();
                }}
                className="rounded-card bg-black px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800"
              >
                Look under the hood
              </button>
              <CtaLink
                href="#demos"
                ctaLocation="hero"
                className="rounded-card border border-white/30 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:border-white hover:bg-white/10"
              >
                Explore the demos
              </CtaLink>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Pipeline CTA */}
      <section className="bg-white px-6 py-section-sm">
        <div className="section-container text-center">
          <ScrollReveal variant="fade">
            <h2 className="font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
              Your session is being measured right now.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-content-secondary">
              Every scroll, click, and page view on this site flows through a real measurement
              pipeline. The same architecture I deploy for clients, running live on your session.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="mx-auto mt-8 flex max-w-lg flex-wrap items-center justify-center gap-2">
              {['Browser', 'GTM', 'sGTM', 'BigQuery', 'Dashboards'].map((node, i, arr) => (
                <span key={node} className="flex items-center gap-2">
                  <span className="whitespace-nowrap rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600">
                    {node}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="hidden text-neutral-300 sm:inline" aria-hidden="true">
                      &rarr;
                    </span>
                  )}
                </span>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.4}>
            <button
              type="button"
              onClick={() => {
                trackClickCta('Look under the hood', 'pipeline-cta');
                open();
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-card bg-black px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800"
            >
              Look under the hood
            </button>
          </ScrollReveal>
        </div>
      </section>

      {/* Demo Spotlights */}
      <div id="demos">
        {/* Demos intro */}
        <section className="bg-white px-6 py-section-sm">
          <div className="section-container">
            <ScrollReveal variant="fade">
              <h2 className="font-display text-display-sm font-bold tracking-tight text-black sm:text-display-md">
                Three business models. Same stack.
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-neutral-500">
                Each demo below is a fully functional front-end generating real events through the
                measurement pipeline. Browse a shop, sign up for a subscription, or submit a
                partnership inquiry, then look under the hood to watch your session data flow
                through every layer.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Individual demo sections */}
        {demos.map(({ href, title, type, description, highlights }, i) => (
          <section key={href} className="border-t border-neutral-100 bg-white px-6 py-section-sm">
            <div className="section-container">
              <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                <ScrollReveal variant={i % 2 === 0 ? 'slideUp' : 'slideLeft'}>
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-400" />
                      <span className="text-xs font-medium uppercase tracking-wider text-content-muted">
                        {type}
                      </span>
                    </div>
                    <h3 className="font-display text-display-sm font-bold tracking-tight text-content">
                      {title}
                    </h3>
                    <p className="mt-3 max-w-xl text-base leading-relaxed text-content-secondary">
                      {description}
                    </p>
                    <CtaLink
                      href={href}
                      ctaLocation={`demo-spotlight-${type.toLowerCase().replace(/\s/g, '-')}`}
                      className="mt-6 inline-flex items-center gap-2 rounded-card border border-neutral-200 px-6 py-3 text-sm font-semibold text-black transition-all hover:border-neutral-400 hover:shadow-card"
                    >
                      Explore {title} →
                    </CtaLink>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={0.2} variant="slideUp">
                  <ul className="space-y-3">
                    {highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-3">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-neutral-300" />
                        <span className="text-sm leading-relaxed text-content-secondary">
                          {highlight}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollReveal>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
