import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Ian Patterson builds measurement infrastructure for marketing teams. A decade across marketing, data, and engineering — from both sides of the table.',
};

export default function AboutPage() {
  return (
    <main className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
          I&#39;m Ian Patterson. I build measurement infrastructure for marketing teams.
        </h1>

        <div className="mt-8 space-y-4 text-neutral-700">
          <p>
            I spent a decade working across marketing, data, and technology — starting in the
            hospitality industry, moving into social media and influencer marketing, then into
            full-stack engineering, and eventually leading data and technology as VP at Allied
            Global Marketing, a major entertainment marketing agency.
          </p>
          <p>
            That non-linear path is the point. I&#39;ve sat in the creative meetings and the
            engineering standups. I&#39;ve presented attribution models to CMOs and debugged data
            layer implementations at midnight before a launch. I&#39;ve built the dashboards that
            executives use to make budget decisions and the pipelines that feed them. Most
            consultants in this space come from one side — either the marketing strategy side or the
            data engineering side. I come from both, which means I can translate between the two in
            a way that&#39;s rare and genuinely useful.
          </p>
          <p>
            In parallel with consulting, I run Tuna Melts My Heart — a cat-themed e-commerce brand
            with 2.5 million Instagram followers. It&#39;s a real business that generates real
            revenue, and it serves as a live testing ground for everything I build. The 2025 and
            2026 Tuna calendars were produced using AI-generated imagery from fine-tuned FLUX models
            — 5,000 units sold, substantial profit, on a creative production cost of $400.
            That&#39;s not a case study I wrote. That&#39;s a case study I lived.
          </p>
          <p>I&#39;m based in Atlanta and I work with clients across the US and UK.</p>
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-neutral-900">What I Believe</h2>
          <div className="mt-6 space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                Measurement infrastructure is not a project. It&#39;s a capability.
              </h3>
              <p className="mt-2 text-neutral-700">
                Most companies treat tracking and analytics as a one-time setup. Then the data
                drifts, the tracking breaks, and nobody notices until a budget decision goes wrong.
                I build systems that monitor themselves, document themselves, and get smarter over
                time.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                AI should be infrastructure, not an afterthought.
              </h3>
              <p className="mt-2 text-neutral-700">
                Every layer of the stack I build has AI-native capabilities — from automated
                campaign taxonomy to natural language reporting to semantic data enrichment. Not
                because AI is trendy, but because these functions are genuinely better when
                they&#39;re embedded in the data pipeline rather than bolted on after the fact.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                You should own your data and your methodology.
              </h3>
              <p className="mt-2 text-neutral-700">
                Platform-reported metrics serve the platform&#39;s interests. Black-box attribution
                tools serve the vendor&#39;s interests. Everything I build lives in your warehouse,
                runs on your infrastructure, and uses methodology you can inspect and understand.
                When the engagement ends, the system keeps running.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
