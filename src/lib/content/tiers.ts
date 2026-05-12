export interface TierComponent {
  title: string;
  description: string;
}

export type TierNum = '01' | '02' | '03' | '04';

export interface Tier {
  num: TierNum;
  title: string;
  subtitle: string;
  lede: string;
  core: TierComponent[];
  optional: TierComponent[];
  summary: string;
  seeItLive?: { href: string };
}

export const TIERS: Tier[] = [
  {
    num: '01',
    title: 'Measurement Foundation',
    subtitle: 'If the source is wrong, nothing downstream gets fixed.',
    lede: "Server-side GTM moves your tracking off the browser and onto a server you control. That's where consent stops being broken, cookies stop expiring on you, and match rates start looking like the platforms claim they do.",
    core: [
      {
        title: 'Tag Audit & Data Layer Spec',
        description:
          'I audit your existing container and produce a documented spec that becomes the blueprint for the server-side implementation. Implementing sGTM on top of a messy client-side container just moves the mess server-side.',
      },
      {
        title: 'Server-Side GTM Deployment',
        description:
          'Full sGTM setup with custom domain and same-origin config for extended cookie life. Hosted on Stape by default; EU-hosted or self-hosted on Google Cloud for enterprise.',
      },
      {
        title: 'Warehouse Event Sink',
        description:
          'Your sGTM event stream flows directly into a data warehouse from day one. Without it, Tier 1 is a dead end, and you should hire a GTM specialist, not me.',
      },
    ],
    optional: [
      {
        title: 'Consent Management Implementation',
        description:
          'CMP deployment integrated with GTM consent mode, enforced server-side. Cookiebot by default, or bring your own.',
      },
      {
        title: 'Event Delivery Configuration',
        description:
          'GA4, Meta CAPI, Google Ads EC standard. Additional platforms like TikTok, LinkedIn, Pinterest, or Snap, scoped to your channel mix.',
      },
      {
        title: 'Real-Time Event Architecture',
        description:
          'Implementation designed with awareness of future real-time streaming (Pub/Sub, webhooks), no decisions that close doors.',
      },
    ],
    summary:
      "Server-side tracking that's properly consented, delivering higher-quality data to your ad platforms and streaming raw events into your warehouse.",
  },
  {
    num: '02',
    title: 'Data Infrastructure',
    subtitle: 'Raw events are a start. A source of truth is the work.',
    lede: 'Raw events landing in a warehouse is the easy part. Turning them into a documented, tested, queryable layer your team and your AI tools both trust is the work that pays off for years.',
    core: [
      {
        title: 'Warehouse Configuration',
        description:
          'BigQuery project setup with proper dataset structure (raw, staging, marts), IAM, and cost controls. The organizational foundation that prevents your warehouse from becoming an ungoverned swamp.',
      },
      {
        title: 'Dataform Transformation Models',
        description:
          'A standardized medallion pipeline: raw → staging → marts. Campaign performance, channel attribution, LTV, session events. The single most valuable deliverable of the engagement. Clients with existing dbt implementations stay on dbt, with a migration conversation available.',
      },
      {
        title: 'Automated Data Quality Framework',
        description:
          'Dataform assertions that continuously validate schema, null rates, volume anomalies, and source freshness. Silent data failures are how teams make decisions on broken numbers for weeks.',
      },
      {
        title: 'Data Dictionary & Schema Docs',
        description:
          'AI-generated, human-reviewed docs of every model, column, and dependency. Ships as a deliverable and lives in the repo, makes your data self-describing for your team and for any AI that needs to work with it.',
      },
      {
        title: 'AI Access Layer',
        description:
          'A scheduled BigQuery export to Cloud Storage in parquet or JSON, a clean handoff point for Claude, ChatGPT, Gemini, or your own internal systems, no direct warehouse access required.',
      },
    ],
    optional: [
      {
        title: 'Data Pipeline Deployment',
        description:
          "Ingestion of ad spend, CRM, and e-commerce data into BigQuery. BigQuery Data Transfer Service by default; Airbyte for sources it doesn't cover.",
      },
      {
        title: 'Automated Campaign Taxonomy',
        description:
          "Dataform models using BigQuery's native AI to standardize campaign names, UTMs, and ad-group naming. Runs continuously, kills the eternal spreadsheet-mapping exercise.",
      },
    ],
    summary:
      'A single source of truth for your marketing data. Clean, documented, AI-enriched, accessible to any downstream tool or AI system.',
    seeItLive: { href: '/demo/ecommerce' },
  },
  {
    num: '03',
    title: 'Business Intelligence',
    subtitle: 'Answers, not dashboards.',
    lede: 'Dashboards are a means to an end. The end is your team answering their own questions, in their tools, on their timeline.',
    core: [],
    optional: [
      {
        title: 'Dashboard Design & Build',
        description:
          'Executive summary, channel performance, and campaign drill-down dashboards on the Tier 2 mart layer. Looker Studio or Metabase, depending on your embedding and access needs.',
      },
      {
        title: 'Natural Language Data Exploration',
        description:
          'Gemini-powered querying in BigQuery for technical users. For marketing teams: the Tier 2 AI Access Layer means you query data with whatever AI tool your team already uses.',
      },
      {
        title: 'Automated Narrative Reporting',
        description:
          'A RAG pipeline built natively in BigQuery that generates written performance summaries delivered to Slack or email on your schedule. Replaces the weekly meeting where someone reads a dashboard aloud.',
      },
    ],
    summary:
      'Your marketing team self-serves answers instead of asking the data person. Your executives get a written summary every Monday that tells them what changed and why.',
    seeItLive: { href: '/demo/ecommerce/confirmation?order_id=ORD-T3-DEMO&total=44.98&items=2' },
  },
  {
    num: '04',
    title: 'Attribution & Advanced',
    subtitle: 'Causation, not correlation.',
    lede: 'Multi-touch attribution, geo-lift incrementality, MMM. The rigorous methods that let you say \u201cthis channel is incremental,\u201d not \u201cthis channel correlates with revenue.\u201d Reserved for clients who\u2019ve completed Tiers 1 and 2 with me. The methodology is only as trustworthy as the pipeline it sits on.',
    core: [],
    optional: [
      {
        title: 'Multi-Touch Attribution Modeling',
        description:
          'Shapley value or position-based models in Dataform on your event data. Replaces platform-reported attribution with logic you own, can inspect, and can trust.',
      },
      {
        title: 'Geo-Lift Incrementality Testing',
        description:
          'The most rigorous, privacy-friendly method for measuring whether a channel is driving incremental revenue or just capturing existing demand. Directly measures causation rather than inferring it from correlation.',
      },
      {
        title: 'Media Mix Modeling',
        description:
          "Bayesian MMM using Google's open-source Meridian framework, running on BigQuery. A budget-allocation model with its assumptions out in the open.",
      },
      {
        title: 'Measurement Strategy & Roadmap',
        description:
          'Ongoing advisory on what to test next, which channels to validate, and how to build a culture of measurement. The retainer component, not maintaining infra, but guiding the questions.',
      },
    ],
    summary:
      "Attribution you own, methodology you can defend to your CFO, a testing roadmap that compounds what you've learned.",
  },
];
