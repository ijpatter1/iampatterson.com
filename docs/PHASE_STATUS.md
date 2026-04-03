# Phase Status Tracker

> **Current Phase: 9A — Homepage & Core Architecture** (COMPLETE)
> Last updated: 2026-04-03, session-2026-04-03-017

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

- ✅ 2026-03-28, session-2026-03-28-009 — Cloud Run service (Node.js/TypeScript) sends events to sGTM via /g/collect (gtag.js format), deployed to Cloud Run with Express server and Dockerfile
- ✅ 2026-03-28, session-2026-03-28-009 — Three data profiles: e-commerce (Tuna Shop — 6 products, funnel with configurable drop-off), subscription (Tuna Subscription Box — 3 plans, lifecycle with churn curves), lead generation (Tuna Brand Partnerships — form funnel with qualification scoring)
- ✅ 2026-03-28, session-2026-03-28-009 — Simulated ad platform data: campaign spend, impressions, clicks by platform, campaign, and date. Includes intentional naming inconsistencies (3-4 UTM variants per campaign) across platforms
- ✅ 2026-03-28, session-2026-03-28-009 — Historical backfill: 18-month backfill deployed and executed for all three models, streaming day-by-day with 30 concurrent requests. Data verified in BigQuery
- ✅ 2026-03-28, session-2026-03-28-009 — Ongoing generation: Cloud Scheduler jobs configured (3 jobs, staggered 02:00-03:00 UTC daily) with OIDC auth to Cloud Run
- ✅ 2026-03-28, session-2026-03-28-009 — Configurable parameters: traffic volume, channel mix (6 platforms), conversion rates, seasonality curves, growth rate, backfill months — all adjustable via GeneratorConfig

---

## Phase 5 — Data Infrastructure (Tier 2 Demonstration)

*Goal: Build the full Dataform transformation layer, campaign taxonomy, data quality framework, and AI access layer.*

- ✅ 2026-03-28, session-2026-03-28-011 — BigQuery dataset structure: `iampatterson_raw` (expanded to 51 cols), `iampatterson_staging`, `iampatterson_marts`. Ad platform table `ad_platform_raw` created
- ✅ 2026-03-28, session-2026-03-28-011 — Dataform repository with full medallion architecture: 3 staging models (`stg_events`, `stg_sessions`, `stg_ad_platform`), constants module, project config
- ✅ 2026-03-28, session-2026-03-28-011 — Mart models: `mart_campaign_performance` (ROAS), `mart_channel_attribution`, `mart_customer_ltv` (by client_id), `mart_session_events`, `mart_subscription_cohorts`, `mart_lead_funnel`
- ✅ 2026-03-28, session-2026-03-28-011 — Automated Campaign Taxonomy: AI.CLASSIFY model + rule-based regex fallback (tested live, 100% classification on 33 campaign variants). Validation table with event volumes
- ✅ 2026-03-28, session-2026-03-28-011 — Automated Data Quality Framework: 6 assertions — schema validation, null checks, purchase revenue, subscription fields, volume anomaly, source freshness
- ✅ 2026-03-28, session-2026-03-28-011 — Data Dictionary: BQ table from INFORMATION_SCHEMA + exportable DATA_DICTIONARY.md with column-level descriptions
- ✅ 2026-03-28, session-2026-03-28-011 — AI Access Layer: GCS export scripts (setup.sh, export.sh), read-only service account setup, 30-day lifecycle policy
- ✅ 2026-03-28, session-2026-03-28-011 — RAG infrastructure: text-embedding-005 + Gemini 2.0 Flash models, vector embeddings on 3 mart tables, IVF indexes, `semantic_search` and `query_business` stored procedures

---

## Phase 6 — Three Demo Front-Ends

*Goal: Build the three mini-sites within iampatterson.com, each representing a different business model and fully instrumented.*

- ✅ 2026-03-29, session-2026-03-29-012 — E-commerce demo (Tuna Shop): product listing (6 products), product detail pages with product_view, cart with add_to_cart, checkout with begin_checkout + purchase, order confirmation
- ✅ 2026-03-29, session-2026-03-29-012 — Subscription demo (Tuna Subscription Box): landing page with 3 plans, plan_select events, trial signup form with trial_signup, account dashboard with upgrade/downgrade/cancel
- ✅ 2026-03-29, session-2026-03-29-012 — Lead gen demo (Tuna Brand Partnerships): landing page, multi-select partnership inquiry form with form_start/form_field_focus/form_complete/lead_qualify, thank you page
- ✅ 2026-03-29, session-2026-03-29-012 — Each demo has its own data layer specification (8 event types) matching the background generator's output
- ✅ 2026-03-29, session-2026-03-29-012 — Route namespaces (/demo/ecommerce, /demo/subscription, /demo/leadgen) with shared DemoNav, demo landing page, Demos dropdown in header
- ✅ 2026-03-29, session-2026-03-29-012 — Flip-the-card overlay from Phase 3 works on all three demos via useFilteredEvents route-aware filtering
- ✅ 2026-03-29, session-2026-03-29-012 — Navigation between demos and back to the main consulting site is seamless (DemoNav + header Demos dropdown)
- ✅ 2026-04-02, session-2026-04-02-014 — Web GTM container updated with 18 DLV variables, 8 custom event triggers, 8 GA4 event tags for demo events (product_view, add_to_cart, begin_checkout, purchase, plan_select, trial_signup, form_complete, lead_qualify). Published as version 7
- ✅ 2026-04-02, session-2026-04-02-014 — sGTM container updated with ce-conversions trigger, Meta CAPI Simulation and Google Ads EC Simulation custom templates + tags. Published as version 13

---

## Phase 7 — BI Layer & Demo Dashboards (Tier 3 Demonstration) (COMPLETE)

*Goal: Build the dashboard and reporting layer for each business model, embeddable or linkable from the demo back-end views.*

- ✅ 2026-04-03, session-2026-04-03-015 — E-commerce dashboards: executive summary (revenue, AOV, conversion rate by channel), campaign performance (spend vs revenue with AI-classified taxonomy), product performance, acquisition funnel. Built with Recharts on mock data matching BigQuery mart schemas
- ✅ 2026-04-03, session-2026-04-03-015 — Subscription dashboards: cohort retention curves, trial-to-paid conversion by channel, MRR/ARR trending, churn analysis, LTV by acquisition source
- ✅ 2026-04-03, session-2026-04-03-015 — Lead gen dashboards: lead funnel (visits → form starts → submissions → qualified leads), cost per lead by channel, lead quality distribution, conversion timeline
- ✅ 2026-04-03, session-2026-04-03-015 — Dashboard embed/deep-link integration with flip-the-card UI: Dashboards tab in overlay, contextual Analytics link in DemoNav

---

## Phase 8 — Frontend Redesign (COMPLETE)

*Goal: Transform the site from a text-heavy layout into a scroll-driven, visually distinctive portfolio experience while preserving all existing event tracking and backend functionality.*

- ✅ 2026-04-03, session-2026-04-03-016 — Design system overhaul — color palette (midnight navy brand), typography (Space Grotesk + Inter), spacing, shadow, animation tokens in Tailwind config
- ✅ 2026-04-03, session-2026-04-03-016 — Scroll-driven homepage rebuild — full-viewport sections, demo spotlights as gallery with per-demo color identity
- ✅ 2026-04-03, session-2026-04-03-016 — Scroll animation system — Framer Motion ScrollReveal component with fade/slideUp/slideLeft/scale variants, reduced-motion support
- ✅ 2026-04-03, session-2026-04-03-016 — Pipeline visualization homepage section — 5-step pipeline teaser (superseded by Phase 9A live visualization)
- ✅ 2026-04-03, session-2026-04-03-016 — Demo visual differentiation — DemoThemeProvider context with per-demo color accents (amber/teal/indigo)
- ✅ 2026-04-03, session-2026-04-03-016 — Dashboard integration into demo flow — DashboardPreview component with KPI cards and narrative at bottom of key demo pages
- ✅ 2026-04-03, session-2026-04-03-016 — Navigation redesign — sticky header with scroll transform and dark-hero awareness, dark footer, DemoNav analytics link removed
- ✅ 2026-04-03, session-2026-04-03-016 — Services page visual hierarchy — full-width tier sections with numbered badges, two-column layouts, dark Tier 4
- ✅ 2026-04-03, session-2026-04-03-016 — About page personality — grid layout with Tuna brand card, dark "What I Believe" section
- ✅ 2026-04-03, session-2026-04-03-016 — Contact page refinement — split layout with form card, branded focus states

*Note: Three Phase 8 deliverables (demo entry transitions, micro-interactions/polish, performance validation) are absorbed into Phase 9A and Phase 10 respectively. Remaining neutral-* class migration across inner demo components deferred to Phase 9 demo-specific work.*

---

## Phase 9A — Homepage & Core Architecture (COMPLETE)

*Goal: Rebuild the homepage interaction model. Replace the sidebar/bottom-sheet overlay with ambient event bubbles + full-page "under the hood" view. The homepage IS the Tier 1 showcase. Remove DemoNav. Full-width demo spotlight sections.*

- ✅ 2026-04-03, session-2026-04-03-017 — Strip "flip the card" language from all copy — footer, proof section, content guide, demo confirmations. Replaced with "under the hood" language
- ✅ 2026-04-03, session-2026-04-03-017 — Ambient event bubbles (Layer 1) — ephemeral, non-interactive event indicators on homepage/consulting pages. Route-aware (hidden on demo pages). Polls dataLayer, auto-fade after 3s
- ✅ 2026-04-03, session-2026-04-03-017 — Full-page "under the hood" view (Layer 2) — replaces Phase 3 sidebar/bottom-sheet with fixed inset-0 full-page view. Old overlay components removed
- ✅ 2026-04-03, session-2026-04-03-017 — Homepage underside content (Tier 1 showcase) — consent visualization, event stream reference, pipeline architecture. Overview tab default on homepage
- ✅ 2026-04-03, session-2026-04-03-017 — Replaced "See the Stack Running Live" static section with dark CTA section featuring pipeline path diagram and "Look under the hood" button that opens overlay
- ✅ 2026-04-03, session-2026-04-03-017 — Full-width demo spotlight sections — 3 full-width scroll sections with per-demo color world, tier badge, highlight bullets, and prominent CTAs
- ✅ 2026-04-03, session-2026-04-03-017 — Kill DemoNav — replaced with DemoFooterNav at bottom of demo pages with cross-demo navigation and back-to-homepage link
- ✅ 2026-04-03, session-2026-04-03-017 — Kill `/demo` landing page — redirects to `/#demos`

---

## Phase 9B — E-Commerce Demo: Tiers 2 & 3 (Data Infrastructure + BI)

*Goal: Each page in the checkout funnel demonstrates a different Tier 2 deliverable. Confirmation page pivots to Tier 3 with actionable insights. Looker Studio / Metabase integration.*

- ⬜ Product listing underside: Campaign Taxonomy — AI-classified UTM parameters shown for visitor's session
- ⬜ Product detail underside: Staging Layer — event flattening and enrichment visualization
- ⬜ Cart underside: Data Quality Framework — live assertion checklist (schema validation, null checks, volume anomaly)
- ⬜ Checkout underside: Warehouse Write — real-time BigQuery write visualization
- ⬜ Confirmation page: Tier 3 pivot — funnel metrics, AOV trends, actionable insight with revenue impact
- ⬜ Looker Studio / Metabase dashboard connected to BigQuery mart tables, embedded from confirmation page under-the-hood
- ⬜ Services page cross-links: Tier 2 → ecommerce funnel, Tier 3 → confirmation page

---

## Phase 9C — Lead Gen Demo: Tier 1 Privacy/Consent + Tier 3 BI + AI

*Goal: Make consent enforcement tangible. Form interaction shows PII handling, consent-gated routing. Thank-you page shows BI + AI narrative reporting.*

- ⬜ Form interaction underside: Consent & Privacy visualization — consent signals, platform routing, email hashing, ad_user_data gating
- ⬜ Live consent enforcement demonstration — deny/grant marketing consent, see routing differences (BigQuery+GA4 only vs full routing with hashed PII)
- ⬜ Thank-you page: Tier 3 BI — lead funnel dashboard, cost per qualified lead by channel
- ⬜ Automated Narrative Reporting (AI) — RAG pipeline generating weekly written summaries for lead gen model, viewable in under-the-hood
- ⬜ Services page cross-links: Tier 1 privacy → lead gen form, Tier 3 AI → narrative reporting sample

---

## Phase 9D — Subscription Demo: Tier 4 (Attribution & Advanced Analytics)

*Goal: Multi-touch attribution, cohort retention by channel, LTV analysis. The most analytically sophisticated tier on the model that benefits most.*

- ⬜ Multi-touch attribution model (Shapley value) built in Dataform for subscription business model
- ⬜ Attribution comparison visualization: Shapley vs last-click vs platform-reported, with narrative methodology explanation
- ⬜ Cohort retention curves by acquisition source — channels that produce high-retention vs high-churn subscribers
- ⬜ LTV by channel analysis using mart_customer_ltv and mart_subscription_cohorts tables
- ⬜ Lightweight MMM or geo-lift demonstration (static analysis if geo data insufficient)
- ⬜ Services page cross-links: Tier 4 → subscription attribution comparison, cohort retention

---

## Phase 10 — Polish, Performance & Launch Prep

*Goal: Optimize the full experience for production readiness.*

- ⬜ Performance optimization: Core Web Vitals, Lighthouse scores, WebSocket connection reliability, overlay rendering performance
- ⬜ Mobile testing across devices and screen sizes
- ⬜ Error handling: graceful degradation if WebSocket drops, BigQuery is slow, or Pub/Sub has latency spikes
- ⬜ Analytics on the site itself: track which demos prospects interact with, overlay activation rates, time spent. Informs sales conversations
- ⬜ Copy and content refinement across all consulting pages
- ⬜ SEO: meta tags, structured data, sitemap, content strategy for organic discoverability
- ⬜ Security review: ensure demo interactions can't expose real data, service accounts properly scoped, no PII leakage in event stream
- ⬜ Load testing on background data generator and WebSocket service

---

## Phase 11 — Operational Readiness & Maintenance Infrastructure

*Goal: Build the monitoring, alerting, and operational tooling needed to keep the full stack healthy in production.*

- ⬜ Cloud Monitoring dashboard: single pane for Cloud Run services, Pub/Sub throughput, BigQuery costs, SSL status
- ⬜ Alerting policies: 5xx error rates, pipeline latency, container crashes, BigQuery cost threshold, Dataform failures, SSL expiry
- ⬜ Uptime checks: automated health probes for sGTM, event-stream, and Vercel site with notification channels
- ⬜ sGTM container lifecycle: update process for gtm-cloud-image releases, version pinning strategy
- ⬜ Data retention and cost controls: BigQuery partition expiration, GCS lifecycle rules, GCP budget alerts
- ⬜ Operational runbook: documented procedures for common failure modes (doubles as portfolio content)
- ⬜ Log aggregation: structured logging across Cloud Run services, log-based metrics, retention policy
- ⬜ Dependency update process: cadence for Node.js, Next.js, Cloud Run images, npm deps, security advisories
