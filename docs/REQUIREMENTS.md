# iampatterson.com — Development Plan & Requirements

## Project Vision

iampatterson.com is simultaneously a consulting site for Patterson Consulting and a live, interactive demonstration of the full measurement infrastructure stack. Visitors experience the site as a polished consulting presence with three embedded demo environments. At any point, they can activate an instrumentation overlay to see the stack running beneath their own session in real time. The site itself is the portfolio.

---

## Phase 1 — Foundation

**Goal:** A functioning Next.js site with basic consulting content, Cookiebot, client-side GTM, and sGTM deployed. No demos yet. No flip UI. Just the consulting site running on the production stack.

**Deliverables:**

1. Next.js project scaffolded with TypeScript (strict) and Tailwind CSS
2. Site structure: homepage, services overview (the four tiers), about/background, contact
3. Cookiebot deployed and integrated with GTM consent mode
4. Client-side GTM container configured with a clean data layer specification
5. sGTM container on Stape with custom domain and same-origin setup
6. GA4 configured via sGTM
7. BigQuery event sink receiving raw event stream from sGTM
8. Basic SEO and performance optimization
9. Deployed to production on Vercel

**Why this is Phase 1:** Everything downstream depends on the site existing and the core instrumentation working. This phase also gives you a live consulting site immediately, even before the demos are built.

---

## Phase 2 — The Real-Time Event Pipeline

**Goal:** Build the infrastructure that allows a visitor's session events to be streamed back to their browser in near real time. This is the engine that powers the flip-the-card experience.

**Deliverables:**

1. Session ID mechanism: sGTM sets a first-party cookie with a unique session identifier, included as a parameter on every event
2. Pub/Sub topic configured to receive events from sGTM (sGTM fires a custom tag that publishes to Pub/Sub on every event)
3. Cloud Run WebSocket/SSE service: subscribes to Pub/Sub, maintains connections per session ID, pushes events to the matching browser client
4. Client-side event stream hook: a React hook that establishes the WebSocket/SSE connection on page load, scoped to the session ID, and maintains an in-memory event buffer
5. Event schema definition: the standardized JSON shape for events flowing through the pipeline, including event name, timestamp, page context, parameters, and routing destinations

**Why this is Phase 2:** The flip UI in Phase 3 is useless without the event stream. Building the pipeline first means you can test it with console logs before investing in the visual layer. It also validates the sGTM → Pub/Sub → Cloud Run → browser chain end to end.

---

## Phase 3 — The Flip-the-Card UI

**Goal:** Build the overlay component system that lets visitors see the instrumentation layer on the consulting site pages.

**Deliverables:**

1. Persistent flip trigger: a subtle, always-visible UI element (bottom-right on desktop, bottom handle on mobile) that activates the overlay
2. Mobile bottom sheet component: pull-up interaction with partial view (event timeline) and full view (pipeline detail). Smooth gesture handling, dismissable by swipe-down
3. Desktop overlay component: translucent layer with annotations mapped to page elements (consent banner, navigation clicks, scroll events). Optional sidebar panel for persistent event stream
4. Event timeline renderer: takes the event buffer from the Phase 2 hook and renders a reverse-chronological list of events with icons indicating routing destinations (GA4, BigQuery, Meta, etc.)
5. Event detail panel: tap/click any event in the timeline to see the full pipeline view for that event — data layer push, sGTM payload, BigQuery row, routing confirmations
6. Narrative flow visualization: the simplified "You did X → This triggered Y → Which was sent to Z" animated pipeline, used as the default view for non-technical visitors
7. Consent-specific overlay: when the consent banner is visible, the overlay shows a focused view of consent state propagation — which tags are active, which are suppressed, how consent is passed server-side. Updates live when the visitor changes their consent preference
8. Page context awareness: the overlay component reads the current Next.js route and filters/contextualizes the event display accordingly

**Why this is Phase 3:** The visual layer is the most design-intensive work. Having the pipeline already functional from Phase 2 means you can develop the UI against real data, not mocks. But the consulting site is already live from Phase 1, so you're not blocked on anything.

*At the end of Phase 3, iampatterson.com is a fully instrumented consulting site with a working flip-the-card experience on the consulting pages. This alone is a compelling demonstration of Tier 1 capabilities.*

---

## Phase 4 — Background Data Generator

**Goal:** Build a service that continuously generates realistic historical and ongoing data for the three demo business models, feeding it through sGTM and into BigQuery so that the Tier 2-4 layers have rich data to work with.

**Deliverables:**

1. Cloud Run service (Python or Node.js) that generates synthetic events and sends them to sGTM via HTTP requests, simulating browser activity
2. Three data profiles, one per business model:
   - **E-commerce (Tuna shop):** Product views, add to cart, checkout, purchase events. Multiple product categories. Traffic from simulated campaigns across Google, Meta, TikTok, email. Realistic AOV distribution, cart abandonment rates, seasonal patterns. Simulated UTM parameters with intentional inconsistencies for the campaign taxonomy layer to clean up
   - **Subscription (Tuna subscription box):** Trial signup, activation, renewal, cancellation, upgrade/downgrade events. Cohort-based churn curves. Acquisition channel mix. Simulated trial-to-paid conversion rates varying by channel. LTV calculations that differ by acquisition source
   - **Lead generation (Tuna brand partnerships landing page):** Page views, form starts, form completions, qualified vs unqualified leads. Traffic from simulated paid campaigns. Lead scoring attributes. Follow-up conversion events (lead → meeting → closed deal)
3. Simulated ad platform data: campaign spend, impressions, clicks by platform, campaign, and date. Fed into BigQuery via scheduled inserts or Airbyte, matching the campaign names and UTMs used by the event generator. Includes intentional naming inconsistencies across platforms
4. Historical backfill: on first run, generates 12-24 months of historical data with realistic trends, seasonality, and growth patterns
5. Ongoing generation: runs continuously, generating a realistic daily volume of events so the data stays fresh and dashboards always show recent activity
6. Configurable parameters: traffic volume, channel mix, conversion rates, seasonality curves — all adjustable so you can tune the realism

**Why this is Phase 4:** The generator is complex but it doesn't block the site or the flip UI. It's needed before the demos can show meaningful Tier 2-4 content, but the consulting site with flip-the-card on its own pages is already live and demonstrable.

---

## Phase 5 — Data Infrastructure (Tier 2 Demonstration)

**Goal:** Build the full Dataform transformation layer, campaign taxonomy, data quality framework, and AI access layer on the data produced by the background generator.

**Deliverables:**

1. BigQuery dataset structure: raw, staging, marts datasets for each of the three business models
2. Dataform repository connected to GitHub with the full medallion architecture:
   - **Raw layer:** untouched event data from sGTM, untouched simulated ad platform data
   - **Staging layer:** flattened events with extracted parameters, standardized column names, deduplication
   - **Mart layer:** `mart_campaign_performance`, `mart_channel_attribution`, `mart_customer_ltv`, `mart_session_events`, `mart_subscription_cohorts`, `mart_lead_funnel` — each scoped to the relevant business model
3. Automated Campaign Taxonomy: Dataform models using `AI.CLASSIFY` and `AI.IF` to standardize the intentionally messy campaign naming from the generator into a clean taxonomy. Validation table showing AI classifications alongside raw inputs
4. Automated Data Quality Framework: Dataform assertions across all models — schema validation, null rate checks, volume anomaly detection, source freshness
5. Data Dictionary: AI-generated documentation for every model and column, living in the Dataform repo and exportable as a reference document
6. AI Access Layer: scheduled BigQuery export to GCS (parquet), read-only service account scoped to mart datasets
7. RAG infrastructure: embeddings generated on mart tables via `ML.GENERATE_TEXT_EMBEDDING`, vector index created, stored procedures for semantic querying

**Why this is Phase 5:** Requires the background data generator to be producing data. This is the heaviest data engineering phase but it's also where your templatized Dataform models get built — these same models become the starting point for real client work.

---

## Phase 6 — The Three Demo Front-Ends

**Goal:** Build the three mini-sites within iampatterson.com, each representing a different business model and fully instrumented with the same stack.

**Deliverables:**

1. **E-commerce demo (Tuna Shop):** Product listing page, product detail page, cart, checkout flow. Uses real Tuna Melts My Heart product imagery and branding. Fully functional front-end with data layer events on every interaction. Does not need real payment processing — the checkout simulates a purchase and fires the event chain
2. **Subscription demo (Tuna Subscription Box):** Landing page, plan selection, trial signup form, account dashboard showing subscription status. Simulates the trial-to-paid journey with events at each stage
3. **Lead gen demo (Tuna Brand Partnerships):** Landing page with value proposition, inquiry form with qualifying fields (company size, budget, partnership type), thank you page with next steps. Events on form field interactions, form start, form submission, and lead qualification
4. Each demo has its own data layer specification and sGTM event schema matching the background generator's output
5. Each demo is contained within a route namespace on iampatterson.com (e.g., /demo/ecommerce, /demo/subscription, /demo/leadgen) and styled to feel like a standalone mini-site while remaining part of the main application
6. The flip-the-card overlay from Phase 3 works on all three demos, showing events contextual to the specific business model
7. Navigation between demos and back to the main consulting site is seamless

**Why this is Phase 6:** The demos need the data infrastructure (Phase 5) to be in place so the flip-the-card back-end views can show meaningful transformed data, not just raw events. Building the front-ends after the data layer is defined also ensures the event schemas match.

---

## Phase 7 — BI Layer & Demo Dashboards (Tier 3 Demonstration)

**Goal:** Build the dashboard and reporting layer for each business model, embeddable or linkable from the demo back-end views.

**Deliverables:**

1. **E-commerce dashboards:** Executive summary (revenue, AOV, conversion rate by channel), campaign performance (spend vs revenue by campaign with AI-classified taxonomy), product performance, customer acquisition funnel
2. **Subscription dashboards:** Cohort retention curves, trial-to-paid conversion by channel, MRR/ARR trending, churn analysis, LTV by acquisition source
3. **Lead gen dashboards:** Lead funnel (visits → form starts → submissions → qualified leads), cost per lead by channel, lead quality distribution, conversion timeline
4. Built in Looker Studio and/or Metabase to demonstrate both options from the decision gate
5. Automated Narrative Reporting: the RAG pipeline from Phase 5 wired to a scheduled job that generates weekly written summaries for each business model, viewable within the demo back-end
6. Dashboard embed or deep-link integration with the flip-the-card UI so prospects can navigate from the event pipeline view to the aggregated dashboard view within the overlay

**Why this is Phase 7:** Requires both the data infrastructure and the demo front-ends to be in place. The dashboards are the payoff — this is where a prospect sees the full pipeline from their click to the board-level KPI.

---

## Phase 8 — Attribution & Advanced Analytics (Tier 4 Demonstration)

**Goal:** Build lightweight MTA and/or MMM demonstrations on the simulated data.

**Deliverables:**

1. Multi-touch attribution model built in Dataform: Shapley value attribution across the simulated channel mix for the e-commerce business model. Comparison view showing MTA results versus last-click versus platform-reported attribution, making the discrepancies visible
2. Lightweight MMM or geo-lift demonstration using the simulated historical data, if the background generator produces geographic segmentation. This may be a static analysis rather than a live model, depending on scope
3. Attribution results surfaced in the demo dashboards and/or as a standalone interactive visualization accessible from the flip-the-card overlay
4. Narrative explanation of methodology accessible within the demo — not just showing the numbers but explaining to a non-technical prospect why these results differ from what their ad platform tells them

**Why this is Phase 8:** This is the final layer. It requires all preceding phases and the most historical data depth. It's also the most impressive demonstration for sophisticated prospects who understand that attribution is broken.

---

## Phase 9 — Polish, Performance & Launch Prep

**Goal:** Optimize the full experience for production readiness.

**Deliverables:**

1. Performance optimization: Core Web Vitals, Lighthouse scores, WebSocket connection reliability, overlay rendering performance
2. Mobile testing across devices and screen sizes
3. Error handling: graceful degradation if the WebSocket connection drops, if BigQuery is slow, if Pub/Sub has latency spikes
4. Analytics on the site itself: track which demos prospects interact with, how many activate the flip overlay, where they spend time. This data informs your own sales conversations
5. Copy and content refinement across all consulting pages
6. SEO: meta tags, structured data, sitemap, content strategy for organic discoverability
7. Security review: ensure demo interactions can't expose real data, service accounts are properly scoped, no PII leakage in the event stream
8. Load testing on the background data generator and WebSocket service

---

## Dependencies & Risk Notes

- Phases 1-3 can be built without any simulated data — they work on real visitor events to the consulting site
- Phase 4 (background generator) is the critical path item for Phases 5-8. If it slips, everything downstream slips
- The Dataform models built in Phase 5 are directly reusable for real client work — this is not throwaway code
- The flip-the-card UI (Phase 3) will likely need iteration after the demos are built (Phase 6) because the demo contexts surface UX requirements that the consulting pages alone don't reveal
- BigQuery managed AI functions (AI.CLASSIFY, AI.IF) are currently in public preview. If they reach GA during development, the implementation stays the same. If Google changes the API surface during preview, Dataform models may need adjustment
- Stape's free tier (10,000 requests/month) may be sufficient during development but will need a paid plan once the background generator is running continuous traffic
- The three demo front-ends are the most scope-creep-prone phase. Each one could absorb unlimited design time. Define a "good enough" visual standard early and stick to it

---

## Technical Architecture Overview

*Frontend:* Next.js, TypeScript, Tailwind CSS. The site, three demo front-ends, and the flip-the-card overlay all live within a single Next.js application.

*Instrumentation Layer:* Cookiebot CMP → client-side GTM data layer → sGTM on Stape → event routing to GA4, Meta CAPI (simulated for demos), Google Ads Enhanced Conversions (simulated for demos), and BigQuery.

*Real-Time Event Pipeline:* sGTM → Pub/Sub topic → Cloud Run WebSocket service → browser via Server-Sent Events or WebSocket, scoped by session ID.

*Data Infrastructure:* BigQuery (raw → staging → marts via Dataform), BigQuery Data Transfer Service and/or Airbyte for simulated platform data, background data generator on Cloud Run.

*BI Layer:* Looker Studio and/or Metabase dashboards running on Dataform mart tables, embedded or linked from the demo back-end views.

*AI Layer:* BigQuery managed AI functions (AI.CLASSIFY, AI.IF) for campaign taxonomy, RAG pipeline for narrative reporting, all native to BigQuery.
