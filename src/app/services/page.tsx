'use client';

import type { ReactNode } from 'react';

import { ScrollReveal } from '@/components/scroll-reveal';

interface ServiceItemProps {
  title: string;
  children: ReactNode;
}

function ServiceItem({ title, children }: ServiceItemProps) {
  return (
    <div>
      <dt className="font-semibold text-content">{title}</dt>
      <dd className="mt-1 text-content-secondary">{children}</dd>
    </div>
  );
}

interface TierSummaryProps {
  children: ReactNode;
}

function TierSummary({ children }: TierSummaryProps) {
  return (
    <p className="mt-8 rounded-card border-l-4 border-brand-500 bg-surface-alt py-4 pl-5 pr-4 text-content-secondary">
      {children}
    </p>
  );
}

const tiers = [
  {
    number: '01',
    title: 'Measurement Foundation',
    subtitle: 'Get the data right at the source.',
    bg: 'bg-surface',
  },
  {
    number: '02',
    title: 'Data Infrastructure',
    subtitle: 'Turn raw events into a source of truth.',
    bg: 'bg-surface-alt',
  },
  {
    number: '03',
    title: 'Business Intelligence',
    subtitle: 'Answers, not dashboards.',
    bg: 'bg-surface',
  },
  {
    number: '04',
    title: 'Attribution & Advanced Analytics',
    subtitle: 'Finally answering "what\u2019s actually working."',
    bg: 'bg-white',
  },
];

export default function ServicesPage() {
  return (
    <main>
      {/* Positioning */}
      <section className="px-6 py-section">
        <div className="prose-container">
          <ScrollReveal>
            <h1 className="max-w-3xl font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
              End-to-end measurement infrastructure. Not just another tag implementation.
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {[
                {
                  tier: '01',
                  title: 'Measurement Foundation',
                  description:
                    'Consent management, server-side Google Tag Manager, and event delivery to your ad platforms. Better data quality, longer cookie life, improved match rates, privacy compliance. This is where every engagement starts.',
                },
                {
                  tier: '02',
                  title: 'Data Infrastructure',
                  description:
                    'Your marketing data in BigQuery, transformed and modeled by Dataform, with AI-native enrichment built into every layer. A single source of truth that replaces the six-platform CSV export your team does every Monday morning.',
                },
                {
                  tier: '03',
                  title: 'Business Intelligence',
                  description:
                    'Dashboards your team can actually use, AI-powered data exploration, and automated weekly reporting that reads like an analyst wrote it. Built on the infrastructure from the previous phases, not bolted on top of raw data.',
                },
                {
                  tier: '04',
                  title: 'Attribution & Advanced Analytics',
                  description:
                    'Multi-touch attribution, media mix modeling, and incrementality testing. The only way to honestly answer "what\u2019s actually working." Available exclusively to clients whose measurement foundation I\u2019ve built, because the models are only as good as the data feeding them.',
                },
              ].map(({ tier, title, description }) => (
                <div
                  key={tier}
                  className="rounded-card border border-neutral-200 bg-white p-6 shadow-card transition-all hover:shadow-elevated"
                >
                  <span className="mb-3 block font-mono text-sm text-content-muted">{tier}</span>
                  <h2 className="mb-2 text-lg font-semibold text-content">{title}</h2>
                  <p className="text-sm leading-relaxed text-content-secondary">{description}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Engagement structure */}
      <section className="bg-surface-alt px-6 py-section">
        <div className="prose-container">
          <ScrollReveal>
            <h2 className="font-display text-display-sm font-bold tracking-tight text-content sm:text-display-md">
              Four tiers. Each one delivers standalone value. Each one makes the next one possible.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed text-content-secondary">
              I structure engagements as discrete tiers with decision gates between them. You buy
              what you need, see the results, and decide whether to go further. The first two tiers
              have non-negotiable components. These are the things that must be done properly or not
              at all. Everything else is modular and scoped to your specific situation.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Tier 1 */}
      <section className={`${tiers[0].bg} px-6 py-section-sm`}>
        <div className="section-container">
          <ScrollReveal>
            <div className="mb-8">
              <span className="font-mono text-sm text-content-muted">{tiers[0].number}</span>
              <h2 className="mt-1 font-display text-display-sm font-bold tracking-tight text-content">
                {tiers[0].title}
              </h2>
              <p className="mt-2 text-lg text-content-muted">{tiers[0].subtitle}</p>
            </div>
          </ScrollReveal>

          <div className="grid gap-12 lg:grid-cols-2">
            <ScrollReveal delay={0.1}>
              <div className="space-y-4 text-content-secondary">
                <p>
                  Server-side Google Tag Manager is the backbone of modern measurement. It moves
                  your tracking from the browser to a server you control, which means longer cookie
                  life, higher ad platform match rates, immunity to ad blockers, and proper consent
                  enforcement. Most marketing teams know they should migrate to server-side. Very
                  few have the expertise to do it properly.
                </p>

                <h3 className="mt-8 text-lg font-semibold text-content">
                  What&apos;s included (non-negotiable):
                </h3>
                <dl className="mt-4 space-y-4">
                  <ServiceItem title="Tag Audit & Data Layer Specification">
                    Before building anything new, I audit your existing client-side GTM container to
                    identify what to keep, what to fix, and what to remove. The output is a
                    documented data layer specification that becomes the blueprint for your
                    server-side implementation. This step is non-negotiable because implementing
                    sGTM on top of a messy client-side container just moves the mess server-side.
                  </ServiceItem>
                  <ServiceItem title="Server-Side GTM Deployment">
                    Full sGTM container setup with custom domain configuration and same-origin setup
                    for extended cookie life. Hosted on Stape by default, with options for EU-hosted
                    infrastructure or self-hosted on Google Cloud for enterprise requirements.
                  </ServiceItem>
                  <ServiceItem title="Warehouse Event Sink">
                    Your sGTM event stream flows directly into a data warehouse from day one. This
                    is the bridge to everything downstream. Without it, Tier 1 is a dead end and you
                    should hire a GTM specialist, not me.
                  </ServiceItem>
                </dl>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <div className="space-y-4 text-content-secondary">
                <h3 className="text-lg font-semibold text-content">
                  Additional components (scoped per client):
                </h3>
                <dl className="mt-4 space-y-4">
                  <ServiceItem title="Consent Management Implementation">
                    CMP deployment and integration with GTM consent mode, ensuring consent state is
                    enforced server-side. Cookiebot by default, with OneTrust or Didomi for
                    enterprise-scale or multi-brand requirements. Not required if you already have a
                    working CMP.
                  </ServiceItem>
                  <ServiceItem title="Event Delivery Configuration">
                    Server-side event delivery to your ad platforms. GA4, Meta Conversions API, and
                    Google Ads Enhanced Conversions are the standard package. TikTok Events API,
                    LinkedIn, Pinterest, and Snap are scoped individually based on your channel mix.
                  </ServiceItem>
                  <ServiceItem title="Real-Time Event Architecture">
                    Your sGTM implementation is designed with awareness of future real-time event
                    streaming capabilities (Pub/Sub, webhooks) even if they&apos;re not activated on
                    day one. No architectural decisions that close doors.
                  </ServiceItem>
                </dl>

                <TierSummary>
                  <strong>What you get at the end of Tier 1:</strong> Server-side tracking
                  that&apos;s properly consented, delivering higher-quality data to your ad
                  platforms and streaming raw events into your warehouse. Better match rates, better
                  attribution signals, privacy compliance, and a foundation for everything that
                  follows.
                </TierSummary>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Tier 2 */}
      <section className={`${tiers[1].bg} px-6 py-section-sm`}>
        <div className="section-container">
          <ScrollReveal>
            <div className="mb-8">
              <span className="font-mono text-sm text-content-muted">{tiers[1].number}</span>
              <h2 className="mt-1 font-display text-display-sm font-bold tracking-tight text-content">
                {tiers[1].title}
              </h2>
              <p className="mt-2 text-lg text-content-muted">{tiers[1].subtitle}</p>
            </div>
          </ScrollReveal>

          <div className="grid gap-12 lg:grid-cols-2">
            <ScrollReveal delay={0.1}>
              <div className="space-y-4 text-content-secondary">
                <p>
                  Raw event data in a warehouse is a start, not a finish. Tier 2 transforms that
                  data into a structured, documented, AI-enriched analytics layer that your team and
                  your tools can actually work with. This is where the real value starts
                  compounding.
                </p>

                <h3 className="mt-8 text-lg font-semibold text-content">
                  What&apos;s included (non-negotiable):
                </h3>
                <dl className="mt-4 space-y-4">
                  <ServiceItem title="Warehouse Configuration">
                    BigQuery project setup with proper dataset structure (raw, staging, marts), IAM
                    permissions, and cost controls. The organizational foundation that prevents your
                    warehouse from becoming an ungoverned data swamp.
                  </ServiceItem>
                  <ServiceItem title="Dataform Transformation Models">
                    A standardized transformation pipeline following a medallion architecture: raw
                    events are cleaned and flattened in staging, then assembled into business-ready
                    mart tables: campaign performance, channel attribution, customer lifetime value,
                    session events. These models are the intellectual property of the engagement and
                    the single most valuable deliverable. Clients with existing dbt implementations
                    stay on dbt, with a migration conversation available.
                  </ServiceItem>
                  <ServiceItem title="Automated Data Quality Framework">
                    Dataform assertions that continuously validate your data: schema checks, null
                    rate monitoring, volume anomaly detection, and source freshness verification.
                    This is a standard line item under every quality Dataform implementation, not an
                    optional add-on. Silent data failures are how teams make decisions on broken
                    numbers for weeks before anyone notices.
                  </ServiceItem>
                  <ServiceItem title="Data Dictionary & Schema Documentation">
                    AI-generated, human-reviewed documentation of every model, every column, every
                    business logic definition, and every upstream dependency. This ships as a
                    deliverable and lives in the Dataform repository. It&apos;s what makes your data
                    self-describing, both for your team and for any AI system that needs to work
                    with it.
                  </ServiceItem>
                  <ServiceItem title="AI Access Layer">
                    A scheduled BigQuery export to Cloud Storage in standard formats (parquet or
                    JSON), providing a clean handoff point for any AI tool (Claude, ChatGPT, Gemini,
                    or your own internal systems) without requiring direct warehouse access. For
                    clients who want direct database connections, a read-only BigQuery service
                    account scoped to mart datasets. LLM-friendly naming conventions are enforced
                    across all models so that any AI system can query your data effectively.
                  </ServiceItem>
                </dl>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <div className="space-y-4 text-content-secondary">
                <h3 className="text-lg font-semibold text-content">
                  Additional components (scoped per client):
                </h3>
                <dl className="mt-4 space-y-4">
                  <ServiceItem title="Data Pipeline Deployment">
                    Ingestion of ad platform spend data, CRM data, and e-commerce platform data into
                    BigQuery. BigQuery Data Transfer Service is the default for supported sources
                    (Google Ads, Shopify, YouTube, Mailchimp). Airbyte for sources not covered by
                    native transfers (Meta Ads, TikTok, Klaviyo, HubSpot) or for clients needing
                    broader connector coverage. Clients with existing ELT tools keep what they have.
                  </ServiceItem>
                  <ServiceItem title="Automated Campaign Taxonomy">
                    Dataform models using BigQuery&apos;s native AI functions to automatically
                    standardize your campaign names, UTM parameters, and ad group naming into a
                    clean, consistent taxonomy. Covers channel classification, campaign type, funnel
                    stage, and product categorization. Includes a validation layer for review and
                    override. Runs continuously as new campaign data flows in, eliminating the
                    eternal spreadsheet-mapping exercise that no one wants to maintain.
                  </ServiceItem>
                </dl>

                <TierSummary>
                  <strong>What you get at the end of Tier 2:</strong> A single source of truth for
                  your marketing data. Clean, documented, AI-enriched, and accessible to any
                  downstream tool or AI system. No more Monday morning CSV exports from six
                  platforms. No more &quot;wait, which campaign is that?&quot; in budget meetings.
                </TierSummary>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Tier 3 */}
      <section className={`${tiers[2].bg} px-6 py-section-sm`}>
        <div className="section-container">
          <ScrollReveal>
            <div className="mb-8">
              <span className="font-mono text-sm text-content-muted">{tiers[2].number}</span>
              <h2 className="mt-1 font-display text-display-sm font-bold tracking-tight text-content">
                {tiers[2].title}
              </h2>
              <p className="mt-2 text-lg text-content-muted">{tiers[2].subtitle}</p>
            </div>
          </ScrollReveal>

          <div className="grid gap-12 lg:grid-cols-2">
            <ScrollReveal delay={0.1}>
              <div className="space-y-4 text-content-secondary">
                <p>
                  Dashboards are a means to an end. The end is your team being able to answer
                  questions about marketing performance without filing a ticket, without waiting
                  three days, and without second-guessing the numbers. Tier 3 is entirely modular.
                  You take what you need.
                </p>

                <h3 className="mt-8 text-lg font-semibold text-content">
                  Components (all modular, scoped per client):
                </h3>
                <dl className="mt-4 space-y-4">
                  <ServiceItem title="Dashboard Design & Build">
                    Executive summary, channel performance, and campaign drill-down dashboards built
                    on the Tier 2 mart layer. Looker Studio for straightforward reporting needs, or
                    Metabase for embedded dashboards with role-based access and client portal use
                    cases. This is a decision gate based on your security and embedding
                    requirements, not an upgrade path.
                  </ServiceItem>
                  <ServiceItem title="Natural Language Data Exploration">
                    Gemini-powered querying is available natively in the BigQuery console for
                    technical users. For most marketing teams, the AI Access Layer from Tier 2
                    enables data exploration through whatever AI tool your team already uses: upload
                    the export to ChatGPT, connect Claude, use Gemini directly. Custom AI workflow
                    implementations for more sophisticated setups are scoped as a separate
                    engagement.
                  </ServiceItem>
                  <ServiceItem title="Automated Narrative Reporting">
                    A RAG pipeline built natively in BigQuery that queries your mart tables,
                    retrieves semantically relevant data, and generates written performance
                    summaries delivered to Slack or email on a schedule you define. Replaces the
                    weekly reporting meeting where someone reads a dashboard aloud. No external AI
                    infrastructure required. The entire pipeline runs inside BigQuery using native
                    AI functions.
                  </ServiceItem>
                </dl>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <TierSummary>
                <strong>What you get at the end of Tier 3:</strong> Your marketing team self-serves
                answers instead of asking the data person. Your executives get a written summary
                every Monday morning that tells them what changed, why, and what to pay attention
                to. Your data infrastructure works for the business, not the other way around.
              </TierSummary>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Tier 4 */}
      <section className={`${tiers[3].bg} px-6 py-section-sm`}>
        <div className="section-container">
          <ScrollReveal>
            <div className="mb-8">
              <span className="font-mono text-sm text-content-muted">{tiers[3].number}</span>
              <h2 className="mt-1 font-display text-display-sm font-bold tracking-tight text-content">
                {tiers[3].title}
              </h2>
              <p className="mt-2 text-lg text-content-muted">{tiers[3].subtitle}</p>
            </div>
          </ScrollReveal>

          <div className="grid gap-12 lg:grid-cols-2">
            <ScrollReveal delay={0.1}>
              <div className="space-y-4 text-content-secondary">
                <p>
                  This tier is only available to clients who have completed Tiers 1 and 2 with
                  Patterson Consulting. Not because of a commercial requirement, but because the
                  models are only as good as the data feeding them, and I need to know the data is
                  right.
                </p>

                <h3 className="mt-8 text-lg font-semibold text-content">
                  Components (scoped independently based on readiness):
                </h3>
                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="font-semibold text-content">Multi-Touch Attribution Modeling</dt>
                    <dd className="mt-1 text-content-secondary">
                      Shapley value or position-based attribution models built in Dataform on your
                      event data in BigQuery. Replaces platform-reported attribution with logic you
                      own, can inspect, and can trust. Privacy-compliant by design, built on
                      first-party data collected through your Tier 1 infrastructure.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-content">Geo-Lift Incrementality Testing</dt>
                    <dd className="mt-1 text-content-secondary">
                      The most rigorous, privacy-friendly method for measuring whether a channel is
                      driving incremental revenue or just capturing existing demand. Uses synthetic
                      control methodology (the same statistical framework used in econometrics and
                      public policy research) to compare test and control markets. Doesn&apos;t
                      depend on user-level tracking, cookies, or device IDs. The only method that
                      directly measures causation rather than inferring it from correlation.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-content">Media Mix Modeling</dt>
                    <dd className="mt-1 text-content-secondary">
                      Bayesian media mix modeling using Google&apos;s open-source Meridian
                      framework, running on BigQuery. Requires 2+ years of historical spend and
                      outcome data. Answers &quot;how should I allocate my budget across
                      channels&quot; with statistical rigor, scenario planning, and an AI-assisted
                      interpretation layer that makes the outputs accessible to non-technical
                      stakeholders.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-content">
                      Measurement Strategy & Testing Roadmap
                    </dt>
                    <dd className="mt-1 text-content-secondary">
                      Ongoing advisory on what to test next, which channels to validate, and how to
                      build a culture of measurement within your marketing team. This is the
                      retainer component: not maintaining infrastructure, but guiding the questions
                      you ask of it.
                    </dd>
                  </div>
                </dl>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="mt-8 rounded-card border-l-4 border-neutral-300 bg-neutral-50 py-4 pl-5 pr-4 text-content-secondary">
                <strong className="text-content">What you get at the end of Tier 4:</strong> An
                honest answer to the hardest question in marketing. Not &quot;what did the platform
                report&quot; but &quot;what actually happened when we spent this money.&quot;
                Attribution you own, methodology you can defend to your CFO, and a testing roadmap
                that gets smarter over time.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </main>
  );
}
