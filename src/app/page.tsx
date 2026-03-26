import { CtaLink } from '@/components/cta-link';

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-neutral-900 px-6 py-24 text-white">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Your marketing data is lying to you.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-300">
            Platform-reported attribution is self-grading homework. Cookie deprecation is eroding
            your signal. Your analytics are built on a client-side stack that was designed for 2018.
            I build the measurement infrastructure that fixes this — from consent and collection
            through to dashboards and attribution — so your marketing team can finally trust the
            numbers.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <CtaLink
              href="/services"
              ctaLocation="hero"
              className="rounded bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
            >
              See how it works
            </CtaLink>
            <CtaLink
              href="#"
              ctaLocation="hero"
              disabled
              className="rounded border border-neutral-500 px-6 py-3 text-sm font-semibold text-neutral-400 cursor-default"
            >
              Explore a live demo
            </CtaLink>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            The measurement gap is getting wider.
          </h2>
          <div className="mt-6 space-y-4 text-neutral-700">
            <p>
              Most marketing teams are running blind and don&#39;t know it. They trust
              platform-reported ROAS numbers that double-count conversions. They rely on cookies
              that Safari kills after seven days. They pay for analytics tools that can&#39;t tell
              them which marketing is actually working.
            </p>
            <p>
              The result: budget decisions based on flawed data, attribution models that reward
              whoever touched the customer last, and no way to answer the question every CMO
              eventually asks — &#34;what would happen if we turned off spend on this channel?&#34;
            </p>
            <p>
              This isn&#39;t a tools problem. You don&#39;t need another dashboard or another
              analytics vendor. You need measurement infrastructure — a system that collects data
              properly, stores it in a warehouse you own, transforms it into something trustworthy,
              and gives you answers you can act on.
            </p>
            <p className="font-semibold text-neutral-900">That&#39;s what I build.</p>
          </div>
        </div>
      </section>

      {/* What I Deliver */}
      <section className="bg-neutral-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            End-to-end measurement infrastructure. Not just another tag implementation.
          </h2>
          <dl className="mt-10 space-y-8">
            <div>
              <dt className="text-lg font-semibold text-neutral-900">Measurement Foundation</dt>
              <dd className="mt-1 text-neutral-700">
                Consent management, server-side Google Tag Manager, and event delivery to your ad
                platforms. Better data quality, longer cookie life, improved match rates, privacy
                compliance. This is where every engagement starts.
              </dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-neutral-900">Data Infrastructure</dt>
              <dd className="mt-1 text-neutral-700">
                Your marketing data in BigQuery, transformed and modeled by Dataform, with AI-native
                enrichment built into every layer. A single source of truth that replaces the
                six-platform CSV export your team does every Monday morning.
              </dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-neutral-900">Business Intelligence</dt>
              <dd className="mt-1 text-neutral-700">
                Dashboards your team can actually use, AI-powered data exploration, and automated
                weekly reporting that reads like an analyst wrote it. Built on the infrastructure
                from the previous phases, not bolted on top of raw data.
              </dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-neutral-900">
                Attribution & Advanced Analytics
              </dt>
              <dd className="mt-1 text-neutral-700">
                Multi-touch attribution, media mix modeling, and incrementality testing. The only
                way to honestly answer &#34;what&#39;s actually working.&#34; Available exclusively
                to clients whose measurement foundation I&#39;ve built, because the models are only
                as good as the data feeding them.
              </dd>
            </div>
          </dl>
          <div className="mt-10">
            <CtaLink
              href="/services"
              ctaLocation="deliver"
              className="text-sm font-semibold text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600"
            >
              Explore the full service offering
            </CtaLink>
          </div>
        </div>
      </section>

      {/* The Proof */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            This site is the case study.
          </h2>
          <div className="mt-6 space-y-4 text-neutral-700">
            <p>
              Every page you&#39;re browsing right now is instrumented with the same stack I sell to
              clients. The consent banner, the server-side tracking, the event pipeline into
              BigQuery, the transformation layer, the dashboards — it&#39;s all running live.
            </p>
            <p>Don&#39;t take my word for it. Flip the card and watch it work.</p>
            <p>
              Below, three fully functional demos show the stack applied to three different business
              models — e-commerce, subscription, and lead generation — each with simulated data
              flowing through every layer from collection to attribution.
            </p>
          </div>
          <div className="mt-8">
            <CtaLink
              href="#"
              ctaLocation="proof"
              disabled
              className="text-sm font-semibold text-neutral-400"
            >
              Explore the demos
            </CtaLink>
          </div>
        </div>
      </section>
    </main>
  );
}
