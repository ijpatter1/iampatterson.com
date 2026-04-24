'use client';

import { ScrollReveal } from '@/components/scroll-reveal';

const beliefs = [
  {
    title: 'Measurement infrastructure is not a project. It\u2019s a capability.',
    body: 'When companies treat tracking and analytics as a one-time setup, the data drifts, the tracking breaks, and nobody notices until a budget decision goes wrong. I build systems that monitor themselves, document themselves, and get smarter over time.',
  },
  {
    title: 'AI should be infrastructure, not an afterthought.',
    body: 'Every layer of the stack I build has AI-native capabilities: automated campaign taxonomy, natural language reporting, semantic data enrichment. Not because AI is trendy, but because these functions are genuinely better when they\u2019re embedded in the data pipeline rather than bolted on after the fact.',
  },
  {
    title: 'You should own your data and your methodology.',
    body: 'Platform-reported metrics serve the platform\u2019s interests. Black-box attribution tools serve the vendor\u2019s interests. Everything I build lives in your warehouse, runs on your infrastructure, and uses methodology you can inspect and understand. When the engagement ends, the system keeps running.',
  },
];

export default function AboutPage() {
  return (
    <main>
      {/* Bio section */}
      <section className="px-6 py-section">
        <div className="section-container">
          <div className="grid gap-12 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ScrollReveal>
                <h1 className="font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
                  I&apos;m Ian Patterson. I build measurement infrastructure for marketing teams.
                </h1>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <div className="mt-8 space-y-5 text-lg leading-relaxed text-content-secondary">
                  <p>
                    I spent a decade working across marketing, data, and technology. Starting in the
                    hospitality industry, moving into social media and influencer marketing, then
                    into full-stack engineering, and eventually leading data and technology as VP at
                    Allied Global Marketing, a major entertainment marketing agency.
                  </p>
                  <p>
                    That non-linear path is the point. I&apos;ve sat in the creative meetings and
                    the engineering standups. I&apos;ve presented attribution models to CMOs and
                    debugged data layer implementations at midnight before a launch. I&apos;ve built
                    the dashboards that executives use to make budget decisions and the pipelines
                    that feed them. I don&apos;t hand off between the strategy and the build.
                  </p>
                </div>
              </ScrollReveal>
            </div>
            <div className="lg:col-span-2">
              <ScrollReveal delay={0.2} variant="fade">
                <div className="rounded-card bg-surface-alt p-8">
                  <p className="text-lg leading-relaxed text-content-secondary">
                    In parallel with consulting, I run{' '}
                    <strong className="text-content">Tuna Melts My Heart</strong>, built around
                    Tuna, a Chiweenie with an exaggerated overbite and 2 million Instagram
                    followers. It&apos;s a real business with multiple revenue streams (merchandise,
                    brand partnerships, licensed content, and live events), and it&apos;s a live
                    testing ground for everything I build.
                  </p>
                  <p className="mt-4 text-sm text-content-muted">
                    Based in Atlanta. Working with clients across the US and UK.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* What I believe */}
      <section className="bg-white px-6 py-section">
        <div className="section-container">
          <ScrollReveal>
            <h2 className="font-display text-display-sm font-bold tracking-tight text-black">
              What I believe
            </h2>
          </ScrollReveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {beliefs.map(({ title, body }, i) => (
              <ScrollReveal key={title} delay={i * 0.15} variant="slideUp">
                <div className="h-full rounded-card border border-neutral-200 p-8 shadow-card">
                  <h3 className="text-lg font-semibold leading-snug text-black">{title}</h3>
                  <p className="mt-4 leading-relaxed text-neutral-500">{body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
