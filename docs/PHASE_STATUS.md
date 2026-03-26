# Phase Status Tracker

> **Current Phase: 1 — Foundation**
> Last updated: 2026-03-26, session-2026-03-26-002

---

## Phase 1 — Foundation

*Goal: A functioning Next.js site with basic consulting content, Cookiebot, client-side GTM, and sGTM deployed.*

- ✅ 2026-03-26, session-2026-03-26-001 — Next.js project scaffolded with TypeScript (strict) and Tailwind CSS
- ✅ 2026-03-26, session-2026-03-26-001 — Site structure: homepage, services overview (the four tiers), about/background, contact
- ✅ 2026-03-26, session-2026-03-26-001 — Data layer event schema defined and wired into all UI components (page_view, scroll_depth, click_nav, click_cta, form events)
- ✅ 2026-03-26, session-2026-03-26-002 — Cookiebot CMP integrated with Consent Mode v2 defaults and consent_update event handler (code-side complete; Cookiebot ID configured)
- ✅ 2026-03-26, session-2026-03-26-002 — Client-side GTM container configured with sGTM same-origin transport (code-side complete; GTM ID configured)
- 🔶 sGTM container on Stape with custom domain — code points to io.iampatterson.com, DNS propagation pending (~72 hours)
- 🔶 GA4 configured via sGTM — Measurement ID known (G-9M2G3RLHWF), sGTM GA4 tag must be configured in Stape UI
- 🔶 BigQuery event sink — setup script ready (`infrastructure/bigquery/setup.sh`), sGTM BigQuery tag must be configured in Stape UI
- ✅ 2026-03-26, session-2026-03-26-001 — Basic SEO and performance optimization
- 🔶 Deployed to production on Vercel — vercel.json ready, repo needs to be connected to Vercel and env vars set

---

## Phase 2 — Real-Time Event Pipeline

*Goal: Build the infrastructure that allows a visitor's session events to be streamed back to their browser in near real time.*

- ⬜ Session ID mechanism: sGTM sets a first-party cookie with a unique session identifier, included as a parameter on every event
- ⬜ Pub/Sub topic configured to receive events from sGTM (sGTM fires a custom tag that publishes to Pub/Sub on every event)
- ⬜ Cloud Run WebSocket/SSE service: subscribes to Pub/Sub, maintains connections per session ID, pushes events to the matching browser client
- ⬜ Client-side event stream hook: a React hook that establishes the WebSocket/SSE connection on page load, scoped to the session ID, and maintains an in-memory event buffer
- ⬜ Event schema definition: the standardized JSON shape for events flowing through the pipeline, including event name, timestamp, page context, parameters, and routing destinations

---

## Phase 3 — Flip-the-Card UI

*Goal: Build the overlay component system that lets visitors see the instrumentation layer on the consulting site pages.*

- ⬜ Persistent flip trigger: a subtle, always-visible UI element (bottom-right on desktop, bottom handle on mobile) that activates the overlay
- ⬜ Mobile bottom sheet component: pull-up interaction with partial view (event timeline) and full view (pipeline detail), smooth gesture handling, dismissable by swipe-down
- ⬜ Desktop overlay component: translucent layer with annotations mapped to page elements, optional sidebar panel for persistent event stream
- ⬜ Event timeline renderer: takes the event buffer from the Phase 2 hook and renders a reverse-chronological list of events with routing destination icons
- ⬜ Event detail panel: tap/click any event to see the full pipeline view — data layer push, sGTM payload, BigQuery row, routing confirmations
- ⬜ Narrative flow visualization: the simplified "You did X → This triggered Y → Which was sent to Z" animated pipeline for non-technical visitors
- ⬜ Consent-specific overlay: focused view of consent state propagation — active/suppressed tags, server-side consent passing. Updates live on consent preference change
- ⬜ Page context awareness: the overlay component reads the current Next.js route and filters/contextualizes the event display accordingly

---

## Phase 4 — Background Data Generator

*Goal: Build a service that continuously generates realistic historical and ongoing data for the three demo business models.*

- ⬜ Cloud Run service (Python or Node.js) that generates synthetic events and sends them to sGTM via HTTP requests, simulating browser activity
- ⬜ Three data profiles: e-commerce (Tuna shop), subscription (Tuna subscription box), lead generation (Tuna brand partnerships) — see REQUIREMENTS.md for full profile specifications
- ⬜ Simulated ad platform data: campaign spend, impressions, clicks by platform, campaign, and date. Includes intentional naming inconsistencies across platforms
- ⬜ Historical backfill: on first run, generates 12-24 months of historical data with realistic trends, seasonality, and growth patterns
- ⬜ Ongoing generation: runs continuously, generating a realistic daily volume of events so the data stays fresh
- ⬜ Configurable parameters: traffic volume, channel mix, conversion rates, seasonality curves — all adjustable

---

## Phase 5 — Data Infrastructure (Tier 2 Demonstration)

*Goal: Build the full Dataform transformation layer, campaign taxonomy, data quality framework, and AI access layer.*

- ⬜ BigQuery dataset structure: raw, staging, marts datasets for each of the three business models
- ⬜ Dataform repository connected to GitHub with full medallion architecture (raw → staging → marts) — see REQUIREMENTS.md for layer specifications
- ⬜ Mart models: `mart_campaign_performance`, `mart_channel_attribution`, `mart_customer_ltv`, `mart_session_events`, `mart_subscription_cohorts`, `mart_lead_funnel` — each scoped to relevant business model
- ⬜ Automated Campaign Taxonomy: Dataform models using `AI.CLASSIFY` and `AI.IF` to standardize messy campaign naming. Validation table showing AI classifications alongside raw inputs
- ⬜ Automated Data Quality Framework: Dataform assertions across all models — schema validation, null rate checks, volume anomaly detection, source freshness
- ⬜ Data Dictionary: AI-generated documentation for every model and column, living in the Dataform repo and exportable
- ⬜ AI Access Layer: scheduled BigQuery export to GCS (parquet), read-only service account scoped to mart datasets
- ⬜ RAG infrastructure: embeddings generated on mart tables via `ML.GENERATE_TEXT_EMBEDDING`, vector index created, stored procedures for semantic querying

---

## Phase 6 — Three Demo Front-Ends

*Goal: Build the three mini-sites within iampatterson.com, each representing a different business model and fully instrumented.*

- ⬜ E-commerce demo (Tuna Shop): product listing page, product detail page, cart, checkout flow with data layer events on every interaction
- ⬜ Subscription demo (Tuna Subscription Box): landing page, plan selection, trial signup form, account dashboard. Simulates trial-to-paid journey with events at each stage
- ⬜ Lead gen demo (Tuna Brand Partnerships): landing page, inquiry form with qualifying fields, thank you page. Events on form field interactions, submission, and lead qualification
- ⬜ Each demo has its own data layer specification and sGTM event schema matching the background generator's output
- ⬜ Route namespaces (/demo/ecommerce, /demo/subscription, /demo/leadgen) styled as standalone mini-sites within the main application
- ⬜ Flip-the-card overlay from Phase 3 works on all three demos, showing events contextual to the specific business model
- ⬜ Navigation between demos and back to the main consulting site is seamless

---

## Phase 7 — BI Layer & Demo Dashboards (Tier 3 Demonstration)

*Goal: Build the dashboard and reporting layer for each business model, embeddable or linkable from the demo back-end views.*

- ⬜ E-commerce dashboards: executive summary (revenue, AOV, conversion rate by channel), campaign performance (spend vs revenue with AI-classified taxonomy), product performance, acquisition funnel
- ⬜ Subscription dashboards: cohort retention curves, trial-to-paid conversion by channel, MRR/ARR trending, churn analysis, LTV by acquisition source
- ⬜ Lead gen dashboards: lead funnel (visits → form starts → submissions → qualified leads), cost per lead by channel, lead quality distribution, conversion timeline
- ⬜ Built in Looker Studio and/or Metabase to demonstrate both options
- ⬜ Automated Narrative Reporting: RAG pipeline wired to scheduled job generating weekly written summaries per business model
- ⬜ Dashboard embed or deep-link integration with flip-the-card UI for pipeline-to-dashboard navigation within the overlay

---

## Phase 8 — Attribution & Advanced Analytics (Tier 4 Demonstration)

*Goal: Build lightweight MTA and/or MMM demonstrations on simulated data.*

- ⬜ Multi-touch attribution model built in Dataform: Shapley value attribution across simulated channel mix for e-commerce model, with comparison view (MTA vs last-click vs platform-reported)
- ⬜ Lightweight MMM or geo-lift demonstration using simulated historical data, if geographic segmentation available (may be static analysis)
- ⬜ Attribution results surfaced in demo dashboards and/or as standalone interactive visualization accessible from flip-the-card overlay
- ⬜ Narrative explanation of methodology accessible within the demo — explaining why results differ from platform-reported attribution

---

## Phase 9 — Polish, Performance & Launch Prep

*Goal: Optimize the full experience for production readiness.*

- ⬜ Performance optimization: Core Web Vitals, Lighthouse scores, WebSocket connection reliability, overlay rendering performance
- ⬜ Mobile testing across devices and screen sizes
- ⬜ Error handling: graceful degradation if WebSocket drops, BigQuery is slow, or Pub/Sub has latency spikes
- ⬜ Analytics on the site itself: track which demos prospects interact with, overlay activation rates, time spent. Informs sales conversations
- ⬜ Copy and content refinement across all consulting pages
- ⬜ SEO: meta tags, structured data, sitemap, content strategy for organic discoverability
- ⬜ Security review: ensure demo interactions can't expose real data, service accounts properly scoped, no PII leakage in event stream
- ⬜ Load testing on background data generator and WebSocket service
