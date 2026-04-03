'use client';

import { CtaLink } from '@/components/cta-link';
import { useOverlay } from '@/components/overlay/overlay-context';
import { ScrollReveal } from '@/components/scroll-reveal';
import { trackClickCta } from '@/lib/events/track';

const tiers = [
  {
    title: 'Measurement Foundation',
    description:
      'Consent management, server-side Google Tag Manager, and event delivery to your ad platforms. Better data quality, longer cookie life, improved match rates, privacy compliance. This is where every engagement starts.',
    tier: '01',
  },
  {
    title: 'Data Infrastructure',
    description:
      'Your marketing data in BigQuery, transformed and modeled by Dataform, with AI-native enrichment built into every layer. A single source of truth that replaces the six-platform CSV export your team does every Monday morning.',
    tier: '02',
  },
  {
    title: 'Business Intelligence',
    description:
      'Dashboards your team can actually use, AI-powered data exploration, and automated weekly reporting that reads like an analyst wrote it. Built on the infrastructure from the previous phases, not bolted on top of raw data.',
    tier: '03',
  },
  {
    title: 'Attribution & Advanced Analytics',
    description:
      'Multi-touch attribution, media mix modeling, and incrementality testing. The only way to honestly answer "what\u2019s actually working." Available exclusively to clients whose measurement foundation I\u2019ve built, because the models are only as good as the data feeding them.',
    tier: '04',
  },
];

const demos = [
  {
    href: '/demo/ecommerce',
    title: 'The Tuna Shop',
    type: 'E-Commerce',
    tiers: 'Tiers 1–4',
    description:
      'A fully instrumented e-commerce storefront. Browse products, add to cart, and complete checkout — every interaction generates events that flow through the full measurement stack.',
    highlights: [
      'Campaign taxonomy classifies your UTM parameters with AI',
      'Data quality assertions validate every event in real time',
      'Revenue attribution compares Shapley value vs last-click',
    ],
    bgClass: 'bg-demo-ecommerce-surface',
    accentClass: 'bg-demo-ecommerce',
    borderClass: 'border-demo-ecommerce',
    textClass: 'text-demo-ecommerce-dark',
  },
  {
    href: '/demo/subscription',
    title: 'Tuna Subscription',
    type: 'Subscription',
    tiers: 'Tiers 1, 3 & 4',
    description:
      'A subscription product from signup to retention. Select a plan, start a trial, and explore the account dashboard — see how cohort analysis and LTV calculations are built on the same event infrastructure.',
    highlights: [
      'Cohort retention curves segmented by acquisition channel',
      'LTV analysis reveals which channels produce lasting subscribers',
      'Multi-touch attribution redistributes credit across the funnel',
    ],
    bgClass: 'bg-demo-subscription-surface',
    accentClass: 'bg-demo-subscription',
    borderClass: 'border-demo-subscription',
    textClass: 'text-demo-subscription-dark',
  },
  {
    href: '/demo/leadgen',
    title: 'Tuna Partnerships',
    type: 'Lead Generation',
    tiers: 'Tiers 1, 3 & AI',
    description:
      'A lead generation landing page with full funnel tracking. Fill out the partnership inquiry form and watch consent enforcement, PII handling, and lead qualification happen in real time.',
    highlights: [
      'Live consent enforcement — deny marketing consent and watch routing change',
      'AI-powered lead scoring classifies inquiries automatically',
      'Automated narrative reporting summarizes pipeline performance weekly',
    ],
    bgClass: 'bg-demo-leadgen-surface',
    accentClass: 'bg-demo-leadgen',
    borderClass: 'border-demo-leadgen',
    textClass: 'text-demo-leadgen-dark',
  },
];

export default function HomePage() {
  const { open } = useOverlay();

  return (
    <main>
      {/* Hero — full viewport, dark, bold typography */}
      <section className="relative flex min-h-[90vh] items-center bg-surface-dark px-6">
        <div className="section-container">
          <ScrollReveal variant="fade" duration={0.8}>
            <h1 className="max-w-4xl font-display text-display-lg font-bold tracking-tight text-content-inverse sm:text-display-xl">
              Your marketing data is lying to you.
            </h1>
          </ScrollReveal>
          <ScrollReveal variant="slideUp" delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-content-on-dark sm:text-xl">
              Platform-reported attribution is self-grading homework. Cookie deprecation is eroding
              your signal. Your analytics are built on a client-side stack that was designed for
              2018. I build the measurement infrastructure that fixes this — from consent and
              collection through to dashboards and attribution — so your marketing team can finally
              trust the numbers.
            </p>
          </ScrollReveal>
          <ScrollReveal variant="slideUp" delay={0.4}>
            <div className="mt-10 flex flex-wrap gap-4">
              <CtaLink
                href="/services"
                ctaLocation="hero"
                className="rounded-card bg-content-inverse px-8 py-3.5 text-sm font-semibold text-surface-dark transition-all hover:bg-brand-100 hover:shadow-glow"
              >
                See how it works
              </CtaLink>
              <CtaLink
                href="#demos"
                ctaLocation="hero"
                className="rounded-card border border-content-on-dark/30 px-8 py-3.5 text-sm font-semibold text-content-inverse transition-all hover:border-content-inverse hover:bg-content-inverse/10"
              >
                Explore a live demo
              </CtaLink>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* The Problem — clean, focused */}
      <section className="px-6 py-section">
        <div className="prose-container">
          <ScrollReveal>
            <h2 className="font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
              The measurement gap is getting wider.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="mt-8 space-y-5 text-lg leading-relaxed text-content-secondary">
              <p>
                Most marketing teams are running blind and don&apos;t know it. They trust
                platform-reported ROAS numbers that double-count conversions. They rely on cookies
                that Safari kills after seven days. They pay for analytics tools that can&apos;t
                tell them which marketing is actually working.
              </p>
              <p>
                The result: budget decisions based on flawed data, attribution models that reward
                whoever touched the customer last, and no way to answer the question every CMO
                eventually asks — &quot;what would happen if we turned off spend on this
                channel?&quot;
              </p>
              <p>
                This isn&apos;t a tools problem. You don&apos;t need another dashboard or another
                analytics vendor. You need measurement infrastructure — a system that collects data
                properly, stores it in a warehouse you own, transforms it into something
                trustworthy, and gives you answers you can act on.
              </p>
              <p className="font-semibold text-content">That&apos;s what I build.</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* What I Deliver — tier cards */}
      <section className="bg-surface-alt px-6 py-section">
        <div className="section-container">
          <ScrollReveal>
            <h2 className="max-w-3xl font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
              End-to-end measurement infrastructure. Not just another tag implementation.
            </h2>
          </ScrollReveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {tiers.map(({ title, description, tier }, i) => (
              <ScrollReveal key={title} delay={i * 0.1} variant="slideUp">
                <div className="group relative h-full rounded-card border border-border bg-surface p-8 transition-all hover:border-brand-300 hover:shadow-elevated">
                  <span className="mb-4 block font-mono text-sm text-content-muted">{tier}</span>
                  <h3 className="mb-3 text-lg font-semibold text-content">{title}</h3>
                  <p className="text-sm leading-relaxed text-content-secondary">{description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal delay={0.4}>
            <div className="mt-10">
              <CtaLink
                href="/services"
                ctaLocation="deliver"
                className="text-sm font-semibold text-content underline underline-offset-4 transition-colors hover:text-brand-500"
              >
                Explore the full service offering →
              </CtaLink>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* The Proof */}
      <section className="px-6 py-section">
        <div className="prose-container">
          <ScrollReveal>
            <h2 className="font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
              This site is the case study.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="mt-8 space-y-5 text-lg leading-relaxed text-content-secondary">
              <p>
                Every page you&apos;re browsing right now is instrumented with the same stack I sell
                to clients. The consent banner, the server-side tracking, the event pipeline into
                BigQuery, the transformation layer, the dashboards — it&apos;s all running live.
              </p>
              <p className="font-semibold text-content">
                Don&apos;t take my word for it. Look under the hood and see for yourself.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Pipeline CTA — under-the-hood teaser */}
      <section className="bg-surface-dark px-6 py-section">
        <div className="section-container text-center">
          <ScrollReveal variant="fade">
            <h2 className="font-display text-display-sm font-bold tracking-tight text-content-inverse sm:text-display-md">
              See what&apos;s running underneath.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-content-on-dark">
              Every scroll, click, and page view on this site flows through a real measurement
              pipeline — right now, including yours.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="mx-auto mt-10 flex max-w-lg items-center justify-center gap-3">
              {['Browser', 'GTM', 'sGTM', 'BigQuery', 'Dashboards'].map((node, i, arr) => (
                <span key={node} className="flex items-center gap-3">
                  <span className="rounded-full border border-content-on-dark/20 px-3 py-1 text-xs font-medium text-content-on-dark">
                    {node}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="text-content-on-dark/40" aria-hidden="true">
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
              className="mt-10 inline-flex items-center gap-2 rounded-card border border-content-on-dark/30 px-8 py-3.5 text-sm font-semibold text-content-inverse transition-all hover:border-content-inverse hover:bg-content-inverse/10"
            >
              Look under the hood
            </button>
          </ScrollReveal>
        </div>
      </section>

      {/* Demo Spotlights — full-width sections */}
      <div id="demos">
        {demos.map(
          (
            {
              href,
              title,
              type,
              tiers,
              description,
              highlights,
              bgClass,
              accentClass,
              borderClass,
              textClass,
            },
            i,
          ) => (
            <section key={href} className={`border-t ${borderClass} ${bgClass} px-6 py-section`}>
              <div className="section-container">
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                  <ScrollReveal variant={i % 2 === 0 ? 'slideUp' : 'slideLeft'}>
                    <div>
                      <div className="mb-4 flex items-center gap-3">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${accentClass}`} />
                        <span className="text-xs font-medium uppercase tracking-wider text-content-muted">
                          {type}
                        </span>
                        <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-content-secondary">
                          {tiers}
                        </span>
                      </div>
                      <h2 className="font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
                        {title}
                      </h2>
                      <p className="mt-4 max-w-xl text-lg leading-relaxed text-content-secondary">
                        {description}
                      </p>
                      <CtaLink
                        href={href}
                        ctaLocation={`demo-spotlight-${type.toLowerCase().replace(/\s/g, '-')}`}
                        className={`mt-8 inline-flex items-center gap-2 rounded-card border ${borderClass} px-6 py-3 text-sm font-semibold ${textClass} transition-all hover:shadow-card`}
                      >
                        Explore {title} →
                      </CtaLink>
                    </div>
                  </ScrollReveal>
                  <ScrollReveal delay={0.2} variant="slideUp">
                    <ul className="space-y-4">
                      {highlights.map((highlight) => (
                        <li key={highlight} className="flex items-start gap-3">
                          <span
                            className={`mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${accentClass}`}
                          />
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
          ),
        )}
      </div>
    </main>
  );
}
