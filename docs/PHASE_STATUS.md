# Phase Status Tracker

> **Current Phase: 4 — Background Data Generator**
> Last updated: 2026-03-27, session-2026-03-27-008

---

## Phase 1 — Foundation

*Goal: A functioning Next.js site with basic consulting content, Cookiebot, client-side GTM, and sGTM deployed.*

- ✅ 2026-03-26, session-2026-03-26-001 — Next.js project scaffolded with TypeScript (strict) and Tailwind CSS
- ✅ 2026-03-26, session-2026-03-26-001 — Site structure: homepage, services overview (the four tiers), about/background, contact
- ✅ 2026-03-26, session-2026-03-26-001 — Data layer event schema defined and wired into all UI components (page_view, scroll_depth, click_nav, click_cta, form events)
- ✅ 2026-03-26, session-2026-03-26-002 — Cookiebot CMP integrated with Consent Mode v2 defaults and consent_update event handler (code-side complete; Cookiebot ID configured)
- ✅ 2026-03-26, session-2026-03-26-002 — Client-side GTM container configured with sGTM same-origin transport (code-side complete; GTM ID configured)
- ✅ 2026-03-26, session-2026-03-26-002 — sGTM container on Stape with custom domain (io.iampatterson.com), DNS verified, GA4 forwarding tag active
- ✅ 2026-03-26, session-2026-03-26-002 — GA4 configured via sGTM (G-9M2G3RLHWF), GA4 forwarding tag with all event/user params
- ✅ 2026-03-26, session-2026-03-26-002 — BigQuery event sink configured: "Write to BigQuery" tag in sGTM writing to `iampatterson.iampatterson_raw.events_raw` with "All Event Data" mode
- ✅ 2026-03-26, session-2026-03-26-001 — Basic SEO and performance optimization
- ✅ 2026-03-26, session-2026-03-26-002 — Deployed to production on Vercel at https://iampatterson-com.vercel.app/
- ✅ 2026-03-26, session-2026-03-26-002 — Web GTM container config spec + importable container (`infrastructure/gtm/web-container.json`, `web-container-import.json`)
- ✅ 2026-03-26, session-2026-03-26-002 — sGTM container config spec + importable container (`infrastructure/gtm/server-container.json`, `server-container-import.json`)

---

## Phase 2 — Real-Time Event Pipeline

*Goal: Build the infrastructure that allows a visitor's session events to be streamed back to their browser in near real time.*

- ✅ 2026-03-26, session-2026-03-26-004 — Session ID mechanism: client-side `_iap_sid` cookie (UUID v4, 30-min sliding window) with `setSessionCookie`, `readSessionCookie`, `getSessionId` utilities
- ✅ 2026-03-26, session-2026-03-26-004 — Pub/Sub topic configured (`iampatterson-events`) with push subscription, sGTM Pub/Sub tag promoted to main config with full message payload spec
- ✅ 2026-03-26, session-2026-03-26-004 — Cloud Run SSE service: Express/Node.js with ConnectionManager, Pub/Sub push endpoint, session-scoped SSE routing, health check, Dockerfile
- ✅ 2026-03-26, session-2026-03-26-004 — Client-side `useEventStream` hook: SSE connection scoped by session ID, in-memory PipelineEvent buffer (most recent first, cap 100), connection status, clearEvents
- ✅ 2026-03-26, session-2026-03-26-004 — Pipeline event schema: PipelineEvent, ConsentState, RoutingResult, RoutingDestination types, isPipelineEvent type guard, createPipelineEvent factory
- ✅ 2026-03-27, session-2026-03-27-005 — Infrastructure deployed: Cloud Run SSE service, Pub/Sub topic + push subscription, sGTM Pub/Sub custom tag template with tests
- ✅ 2026-03-27, session-2026-03-27-005 — End-to-end pipeline verified: browser → GTM → sGTM → Pub/Sub → Cloud Run → SSE → browser

---

## Phase 3 — Flip-the-Card UI

*Goal: Build the overlay component system that lets visitors see the instrumentation layer on the consulting site pages.*

- ✅ 2026-03-27, session-2026-03-27-006 — Persistent flip trigger: fixed bottom-right button with OverlayProvider context for open/closed state
- ✅ 2026-03-27, session-2026-03-27-006 — Mobile bottom sheet component: pull-up with drag handle, swipe-down dismiss (>80px), backdrop, max 85vh
- ✅ 2026-03-27, session-2026-03-27-006 — Desktop overlay component: right-anchored w-96 sidebar with backdrop blur, hidden on mobile (md:flex)
- ✅ 2026-03-27, session-2026-03-27-006 — Event timeline renderer: reverse-chronological list with routing destination badges (sent/blocked/error styling)
- ✅ 2026-03-27, session-2026-03-27-006 — Event detail panel: full pipeline view — data layer parameters, consent state, routing confirmations with status badges
- ✅ 2026-03-27, session-2026-03-27-006 — Narrative flow visualization: "You did X → Data Layer → sGTM → Destinations" step-by-step cards with arrow connectors
- ✅ 2026-03-27, session-2026-03-27-006 — Consent-specific overlay: consent signal cards (granted/denied), active/suppressed destination lists, descriptions per signal
- ✅ 2026-03-27, session-2026-03-27-006 — Page context awareness: useFilteredEvents hook reads Next.js route, filters events by page path with demo namespace support

---

## Phase 4 — Background Data Generator

*Goal: Build a service that continuously generates realistic historical and ongoing data for the three demo business models.*

- ✅ 2026-03-27, session-2026-03-27-008 — Cloud Run service (Node.js/TypeScript) that generates synthetic events and sends them to sGTM via GA4 Measurement Protocol, with Express server and Dockerfile
- ✅ 2026-03-27, session-2026-03-27-008 — Three data profiles: e-commerce (Tuna Shop — 6 products, funnel with configurable drop-off), subscription (Tuna Subscription Box — 3 plans, lifecycle with churn curves), lead generation (Tuna Brand Partnerships — form funnel with qualification scoring)
- ✅ 2026-03-27, session-2026-03-27-008 — Simulated ad platform data: campaign spend, impressions, clicks by platform, campaign, and date. Includes intentional naming inconsistencies (3-4 UTM variants per campaign) across platforms
- ✅ 2026-03-27, session-2026-03-27-008 — Historical backfill: configurable months of historical data with seasonality (monthly, day-of-week, hour-of-day curves) and growth patterns
- ✅ 2026-03-27, session-2026-03-27-008 — Ongoing generation: /generate endpoint produces realistic daily volume; continuous mode via scheduled Cloud Scheduler triggers
- ✅ 2026-03-27, session-2026-03-27-008 — Configurable parameters: traffic volume, channel mix (6 platforms), conversion rates, seasonality curves, growth rate, backfill months — all adjustable via GeneratorConfig

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
- ⬜ Web GTM container updated with demo event tags — e-commerce (`product_view`, `add_to_cart`, `purchase`), subscription (`trial_signup`, `plan_select`), lead gen (`form_complete`, `lead_qualify`) events
- ⬜ sGTM container updated with demo event triggers, GA4 forwarding, BigQuery write tags, simulated Meta CAPI and Google Ads Enhanced Conversions tags

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
