import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Four tiers of measurement infrastructure — from server-side tagging through to attribution modeling. Each one delivers standalone value.',
};

export default function ServicesPage() {
  return (
    <main className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
          Four tiers. Each one delivers standalone value. Each one makes the next one possible.
        </h1>
        <p className="mt-6 text-neutral-700">
          I structure engagements as discrete tiers with decision gates between them. You buy what
          you need, see the results, and decide whether to go further. The first two tiers have
          non-negotiable components — these are the things that must be done properly or not at all.
          Everything else is modular and scoped to your specific situation.
        </p>

        {/* Tier 1 */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-neutral-900">Tier 1: Measurement Foundation</h2>
          <p className="mt-1 text-lg text-neutral-500">Get the data right at the source.</p>
          <div className="mt-4 space-y-4 text-neutral-700">
            <p>
              Server-side Google Tag Manager is the backbone of modern measurement. It moves your
              tracking from the browser to a server you control, which means longer cookie life,
              higher ad platform match rates, immunity to ad blockers, and proper consent
              enforcement. Most marketing teams know they should migrate to server-side. Very few
              have the expertise to do it properly.
            </p>

            <h3 className="mt-8 text-lg font-semibold text-neutral-900">
              What&#39;s included (non-negotiable):
            </h3>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="font-semibold text-neutral-900">
                  Tag Audit & Data Layer Specification
                </dt>
                <dd className="mt-1 text-neutral-700">
                  Before building anything new, I audit your existing client-side GTM container to
                  identify what to keep, what to fix, and what to remove. The output is a documented
                  data layer specification that becomes the blueprint for your server-side
                  implementation. This step is non-negotiable because implementing sGTM on top of a
                  messy client-side container just moves the mess server-side.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Server-Side GTM Deployment</dt>
                <dd className="mt-1 text-neutral-700">
                  Full sGTM container setup with custom domain configuration and same-origin setup
                  for extended cookie life. Hosted on Stape by default, with options for EU-hosted
                  infrastructure or self-hosted on Google Cloud for enterprise requirements.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Warehouse Event Sink</dt>
                <dd className="mt-1 text-neutral-700">
                  Your sGTM event stream flows directly into a data warehouse from day one. This is
                  the bridge to everything downstream — without it, Tier 1 is a dead end and you
                  should hire a GTM specialist, not me.
                </dd>
              </div>
            </dl>

            <h3 className="mt-8 text-lg font-semibold text-neutral-900">
              Additional components (scoped per client):
            </h3>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="font-semibold text-neutral-900">
                  Consent Management Implementation
                </dt>
                <dd className="mt-1 text-neutral-700">
                  CMP deployment and integration with GTM consent mode, ensuring consent state is
                  enforced server-side. Cookiebot by default, with OneTrust or Didomi for
                  enterprise-scale or multi-brand requirements. Not required if you already have a
                  working CMP.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Event Delivery Configuration</dt>
                <dd className="mt-1 text-neutral-700">
                  Server-side event delivery to your ad platforms. GA4, Meta Conversions API, and
                  Google Ads Enhanced Conversions are the standard package. TikTok Events API,
                  LinkedIn, Pinterest, and Snap are scoped individually based on your channel mix.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Real-Time Event Architecture</dt>
                <dd className="mt-1 text-neutral-700">
                  Your sGTM implementation is designed with awareness of future real-time event
                  streaming capabilities (Pub/Sub, webhooks) even if they&#39;re not activated on
                  day one. No architectural decisions that close doors.
                </dd>
              </div>
            </dl>

            <p className="mt-8 border-l-2 border-neutral-300 pl-4 text-neutral-600">
              <strong>What you get at the end of Tier 1:</strong> Server-side tracking that&#39;s
              properly consented, delivering higher-quality data to your ad platforms and streaming
              raw events into your warehouse. Better match rates, better attribution signals,
              privacy compliance, and a foundation for everything that follows.
            </p>
          </div>
        </section>

        {/* Tier 2 */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-neutral-900">Tier 2: Data Infrastructure</h2>
          <p className="mt-1 text-lg text-neutral-500">Turn raw events into a source of truth.</p>
          <div className="mt-4 space-y-4 text-neutral-700">
            <p>
              Raw event data in a warehouse is a start, not a finish. Tier 2 transforms that data
              into a structured, documented, AI-enriched analytics layer that your team and your
              tools can actually work with. This is where the real value starts compounding.
            </p>

            <h3 className="mt-8 text-lg font-semibold text-neutral-900">
              What&#39;s included (non-negotiable):
            </h3>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="font-semibold text-neutral-900">Warehouse Configuration</dt>
                <dd className="mt-1 text-neutral-700">
                  BigQuery project setup with proper dataset structure (raw, staging, marts), IAM
                  permissions, and cost controls. The organizational foundation that prevents your
                  warehouse from becoming an ungoverned data swamp.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Dataform Transformation Models</dt>
                <dd className="mt-1 text-neutral-700">
                  A standardized transformation pipeline following a medallion architecture: raw
                  events are cleaned and flattened in staging, then assembled into business-ready
                  mart tables — campaign performance, channel attribution, customer lifetime value,
                  session events. These models are the intellectual property of the engagement and
                  the single most valuable deliverable. Clients with existing dbt implementations
                  stay on dbt, with a migration conversation available.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Automated Data Quality Framework</dt>
                <dd className="mt-1 text-neutral-700">
                  Dataform assertions that continuously validate your data: schema checks, null rate
                  monitoring, volume anomaly detection, and source freshness verification. This is a
                  standard line item under every quality Dataform implementation, not an optional
                  add-on. Silent data failures are how teams make decisions on broken numbers for
                  weeks before anyone notices.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">
                  Data Dictionary & Schema Documentation
                </dt>
                <dd className="mt-1 text-neutral-700">
                  AI-generated, human-reviewed documentation of every model, every column, every
                  business logic definition, and every upstream dependency. This ships as a
                  deliverable and lives in the Dataform repository. It&#39;s what makes your data
                  self-describing — both for your team and for any AI system that needs to work with
                  it.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">AI Access Layer</dt>
                <dd className="mt-1 text-neutral-700">
                  A scheduled BigQuery export to Cloud Storage in standard formats (parquet or
                  JSON), providing a clean handoff point for any AI tool — Claude, ChatGPT, Gemini,
                  or your own internal systems — without requiring direct warehouse access. For
                  clients who want direct database connections, a read-only BigQuery service account
                  scoped to mart datasets. LLM-friendly naming conventions are enforced across all
                  models so that any AI system can query your data effectively.
                </dd>
              </div>
            </dl>

            <h3 className="mt-8 text-lg font-semibold text-neutral-900">
              Additional components (scoped per client):
            </h3>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="font-semibold text-neutral-900">Data Pipeline Deployment</dt>
                <dd className="mt-1 text-neutral-700">
                  Ingestion of ad platform spend data, CRM data, and e-commerce platform data into
                  BigQuery. BigQuery Data Transfer Service is the default for supported sources
                  (Google Ads, Shopify, YouTube, Mailchimp). Airbyte for sources not covered by
                  native transfers (Meta Ads, TikTok, Klaviyo, HubSpot) or for clients needing
                  broader connector coverage. Clients with existing ELT tools keep what they have.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Automated Campaign Taxonomy</dt>
                <dd className="mt-1 text-neutral-700">
                  Dataform models using BigQuery&#39;s native AI functions to automatically
                  standardize your campaign names, UTM parameters, and ad group naming into a clean,
                  consistent taxonomy. Covers channel classification, campaign type, funnel stage,
                  and product categorization. Includes a validation layer for review and override.
                  Runs continuously as new campaign data flows in, eliminating the eternal
                  spreadsheet-mapping exercise that no one wants to maintain.
                </dd>
              </div>
            </dl>

            <p className="mt-8 border-l-2 border-neutral-300 pl-4 text-neutral-600">
              <strong>What you get at the end of Tier 2:</strong> A single source of truth for your
              marketing data. Clean, documented, AI-enriched, and accessible to any downstream tool
              or AI system. No more Monday morning CSV exports from six platforms. No more
              &#34;wait, which campaign is that?&#34; in budget meetings.
            </p>
          </div>
        </section>

        {/* Tier 3 */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-neutral-900">Tier 3: Business Intelligence</h2>
          <p className="mt-1 text-lg text-neutral-500">Answers, not dashboards.</p>
          <div className="mt-4 space-y-4 text-neutral-700">
            <p>
              Dashboards are a means to an end. The end is your team being able to answer questions
              about marketing performance without filing a ticket, without waiting three days, and
              without second-guessing the numbers. Tier 3 is entirely modular — you take what you
              need.
            </p>

            <dl className="mt-4 space-y-4">
              <div>
                <dt className="font-semibold text-neutral-900">Dashboard Design & Build</dt>
                <dd className="mt-1 text-neutral-700">
                  Executive summary, channel performance, and campaign drill-down dashboards built
                  on the Tier 2 mart layer. Looker Studio for straightforward reporting needs, or
                  Metabase for embedded dashboards with role-based access and client portal use
                  cases. This is a decision gate based on your security and embedding requirements,
                  not an upgrade path.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">
                  Natural Language Data Exploration
                </dt>
                <dd className="mt-1 text-neutral-700">
                  Gemini-powered querying is available natively in the BigQuery console for
                  technical users. For most marketing teams, the AI Access Layer from Tier 2 enables
                  data exploration through whatever AI tool your team already uses — upload the
                  export to ChatGPT, connect Claude, use Gemini directly. Custom AI workflow
                  implementations for more sophisticated setups are scoped as a separate engagement.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Automated Narrative Reporting</dt>
                <dd className="mt-1 text-neutral-700">
                  A RAG pipeline built natively in BigQuery that queries your mart tables, retrieves
                  semantically relevant data, and generates written performance summaries delivered
                  to Slack or email on a schedule you define. Replaces the weekly reporting meeting
                  where someone reads a dashboard aloud. No external AI infrastructure required —
                  the entire pipeline runs inside BigQuery using native AI functions.
                </dd>
              </div>
            </dl>

            <p className="mt-8 border-l-2 border-neutral-300 pl-4 text-neutral-600">
              <strong>What you get at the end of Tier 3:</strong> Your marketing team self-serves
              answers instead of asking the data person. Your executives get a written summary every
              Monday morning that tells them what changed, why, and what to pay attention to. Your
              data infrastructure works for the business, not the other way around.
            </p>
          </div>
        </section>

        {/* Tier 4 */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-neutral-900">
            Tier 4: Attribution & Advanced Analytics
          </h2>
          <p className="mt-1 text-lg text-neutral-500">
            Finally answering &#34;what&#39;s actually working.&#34;
          </p>
          <div className="mt-4 space-y-4 text-neutral-700">
            <p>
              This tier is only available to clients who have completed Tiers 1 and 2 with Patterson
              Consulting. Not because of a commercial requirement — because the models are only as
              good as the data feeding them, and I need to know the data is right.
            </p>

            <dl className="mt-4 space-y-4">
              <div>
                <dt className="font-semibold text-neutral-900">Multi-Touch Attribution Modeling</dt>
                <dd className="mt-1 text-neutral-700">
                  Shapley value or position-based attribution models built in Dataform on your event
                  data in BigQuery. Replaces platform-reported attribution with logic you own, can
                  inspect, and can trust. Privacy-compliant by design — built on first-party data
                  collected through your Tier 1 infrastructure.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Geo-Lift Incrementality Testing</dt>
                <dd className="mt-1 text-neutral-700">
                  The most rigorous, privacy-friendly method for measuring whether a channel is
                  driving incremental revenue or just capturing existing demand. Uses synthetic
                  control methodology (the same statistical framework used in econometrics and
                  public policy research) to compare test and control markets. Doesn&#39;t depend on
                  user-level tracking, cookies, or device IDs. The only method that directly
                  measures causation rather than inferring it from correlation.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Media Mix Modeling</dt>
                <dd className="mt-1 text-neutral-700">
                  Bayesian media mix modeling using Google&#39;s open-source Meridian framework,
                  running on BigQuery. Requires 2+ years of historical spend and outcome data.
                  Answers &#34;how should I allocate my budget across channels&#34; with statistical
                  rigor, scenario planning, and an AI-assisted interpretation layer that makes the
                  outputs accessible to non-technical stakeholders.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">
                  Measurement Strategy & Testing Roadmap
                </dt>
                <dd className="mt-1 text-neutral-700">
                  Ongoing advisory on what to test next, which channels to validate, and how to
                  build a culture of measurement within your marketing team. This is the retainer
                  component — not maintaining infrastructure, but guiding the questions you ask of
                  it.
                </dd>
              </div>
            </dl>

            <p className="mt-8 border-l-2 border-neutral-300 pl-4 text-neutral-600">
              <strong>What you get at the end of Tier 4:</strong> An honest answer to the hardest
              question in marketing. Not &#34;what did the platform report&#34; but &#34;what
              actually happened when we spent this money.&#34; Attribution you own, methodology you
              can defend to your CFO, and a testing roadmap that gets smarter over time.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
