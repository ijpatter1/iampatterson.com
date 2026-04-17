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
4. Dashboard embed or deep-link integration with the flip-the-card UI so prospects can navigate from the event pipeline view to the aggregated dashboard view within the overlay

**Why this is Phase 7:** Requires both the data infrastructure and the demo front-ends to be in place. The dashboards are the payoff — this is where a prospect sees the full pipeline from their click to the board-level KPI.

---

## Phase 8 — Frontend Redesign

**Goal:** Transform the site from a text-heavy consulting document into a scroll-driven, visually distinctive portfolio experience that demonstrates the same design sophistication as the technical infrastructure underneath it. All existing event tracking, data layer wiring, and backend functionality must be preserved.

**Deliverables:**

1. **Design system overhaul** — Replace the neutral-gray-on-white template aesthetic with a distinctive visual identity. Custom color palette, typography scale (display font for headings, clean sans for body), spacing rhythm, and component patterns. Define as Tailwind theme tokens so every component inherits the system. The site should look like it was designed by someone with taste, not generated by a template.

2. **Scroll-driven homepage rebuild** — Rebuild the homepage as a sequence of full-viewport sections that reveal themselves on scroll. Each section gets one idea per screen. The hero is bold typography with minimal supporting text — let "Your marketing data is lying to you" land without competition from a paragraph. The four tiers become visual cards or animated reveals, not a `<dl>`. The demos section becomes a Perry Wang–style spotlight gallery with three visually distinct cards, each reflecting the demo's own color world, serving as the primary entry point into each demo (replacing the `/demo` landing page).

3. **Scroll animation system** — Implement scroll-triggered animations using Framer Motion, CSS scroll-driven animations, or Intersection Observer. Fade-ins, slide-ups, parallax layers, sticky sections, and progressive reveals. Must be performant (no layout thrash, GPU-composited transforms only) and respect `prefers-reduced-motion`. This is the backbone that makes the homepage feel alive rather than static.

4. **Flip-the-card as a first-class homepage element** — Elevate the instrumentation overlay from a hidden corner button to a featured homepage section. Consider a scroll-triggered "flip" moment where the page itself reveals the instrumentation layer — showing events flowing through the pipeline in real time as the visitor scrolls. The existing overlay system (Phase 3) stays functional, but the homepage gives visitors their first taste of it without requiring them to find and click a button.

5. **Demo visual differentiation** — Each demo gets its own color accent, visual mood, and layout variations applied across all its pages. Not three separate design systems — three variations on the base system. The Tuna Shop leans warm and playful (amber/terracotta accent). The subscription box feels premium and curated (deeper tones, structured grid). The partnerships page feels polished and editorial (cooler accent, more whitespace). The color identity carries from the homepage spotlight card through every page of the demo.

6. **Intentional demo entry transitions** — The spotlight-to-demo navigation should feel like entering a distinct environment, not a standard page load. Color wash, card expansion, or similar bridging animation that transitions the visitor from the homepage palette into the demo's palette.

7. **Dashboard integration into demo flow** — Remove dashboards as standalone pages behind a nav link. Instead, embed a curated dashboard preview (3-4 KPI cards, one chart, narrative framing) at the bottom of each demo's key pages — the ecommerce product listing, the subscription plans page, the lead gen landing. This completes the narrative arc: interact with the business model (Act 1), see events flow in real time via the flip overlay (Act 2), see the aggregated business intelligence this produces at scale (Act 3). Full dashboard depth available via expand/scroll for prospects who want to dig in.

8. **Navigation redesign** — Redesign the header for personality: minimal sticky nav that transforms on scroll (e.g., shrinks from full to compact), smooth scroll-to-section for the homepage, and a more intentional mobile experience. The Demos dropdown becomes simpler — three demos, no analytics sub-link. Remove the DemoNav analytics link (dashboards are now inline).

9. **Services page visual hierarchy** — Restructure as distinct visual sections rather than continuous prose. Each tier gets its own visual treatment — possibly full-width sections with alternating layouts, icon or illustration accents, and clear visual gates between tiers. The non-negotiable vs. additional component distinction should be immediately visible, not buried in heading hierarchy.

10. **About page personality** — Give the bio a layout that feels personal rather than corporate. Consider a two-column layout with a photo or visual element, pull quotes for the "What I Believe" principles, and a visual connection to Tuna Melts My Heart. This is a differentiator, not a footnote.

11. **Contact page refinement** — Tighten the layout. Consider a split layout or a more conversational form pattern that feels inviting rather than generic.

12. **Micro-interactions and polish** — Button hover states, link transitions, page transition animations (App Router), subtle scroll indicators. Every interactive element should respond with intention. The details that separate a designed experience from a coded one.

13. **Performance validation** — After the redesign, validate that Core Web Vitals remain strong. Animation libraries add weight — measure LCP, CLS, and INP. Ensure the instrumentation layer (GTM, Cookiebot, sGTM transport) doesn't regress. Run a full event tracking regression check to confirm all data layer events still fire correctly.

**Constraints:**

- All existing data layer events must continue firing correctly. Every `trackClickCta`, `trackPageView`, `trackScrollDepth`, etc. call must be preserved in the redesigned components.
- The flip-the-card overlay system (Phase 3) stays architecturally unchanged. The redesign may change the trigger's visual treatment but not the overlay mechanics.
- Demo pages get the color differentiation and dashboard integration treatment but not a full structural reimagining — they serve a functional purpose.
- No new backend infrastructure. This is purely a presentation layer phase.

**Why this is Phase 8:** Phase 7 built the dashboards and data visualization layer. Before adding more analytical depth (attribution, MMM), the site needs to look and feel worthy of what's running underneath. The redesign also integrates the Phase 7 dashboards into the demo flow, completing the narrative arc. Phase 10 (Polish) provides a final opportunity to refine the design after the advanced analytics layer is added.

---

## Phase 9A — Homepage & Core Architecture

**Goal:** Rebuild the homepage interaction model and core UX architecture. Replace the sidebar/bottom-sheet overlay with a two-layer system (ambient event indicators + full-page "under the hood" view). Restructure the homepage as the Tier 1 showcase. Remove DemoNav and make the homepage the primary navigation hub for demos.

**Context:** The Phase 3 overlay system ("flip the card") uses a metaphor the UI doesn't deliver — there's no card, no flip. The sidebar/bottom sheet fights mobile scrolling and feels like a debug panel, not an integrated experience. This phase replaces it with an interaction model that earns the "under the hood" metaphor: the page literally has an underside that reveals the instrumentation engine.

**Deliverables:**

1. **Strip "flip the card" language** — Remove from all copy: footer, hero, proof section, content guide, demo post-submission confirmations. Replace with language that describes the actual interaction (e.g., "look under the hood," "see what's running underneath") or hold for the new mechanic. Update `docs/CONTENT_GUIDE.md` as the source of truth.

2. **Ambient event bubbles (Layer 1)** — As the visitor interacts with the homepage and consulting pages, small non-interactive event indicators appear — floating up from the bottom edge or near the triggering element. Ephemeral, not clickable, no content blocking. They communicate "things are happening" without demanding attention or competing with scroll. This replaces the corner flip-trigger button as the "something is happening" signal. Not shown on demo pages (to avoid distraction during functional interactions).

3. **Full-page "under the hood" view (Layer 2)** — A dedicated full-page view the visitor opts into. Not a sidebar, not a partial overlay. The page flips to reveal the instrumentation engine underneath. Triggered by a clear CTA (not a corner button). Should feel like lifting the hood of a car, not opening a drawer. Remove the Phase 3 sidebar/bottom-sheet overlay system entirely.

4. **Homepage underside content (Tier 1 showcase)** — The homepage IS the Tier 1 demonstration. The underside shows: consent management visualization (the Cookiebot banner is right there — show what it controls), live event stream with narrative as the visitor scrolls/clicks, pipeline architecture with real events flowing through it (sGTM processing, destination routing). Every visitor experiences Tier 1 just by being on the site.

5. **Replace "See the Stack Running Live" section** — The current static pipeline visualization (5 numbered cards) is prose describing what you could see. Replace with either a live animated pipeline diagram with events actually flowing through it, or collapse into a single compelling CTA to trigger the under-the-hood view. Don't describe what the visitor could see — show it or offer it.

6. **Full-width demo spotlight sections** — Replace the 3-card demo grid with 3 full-width scroll sections, each with its own color world and visual identity. Each section gets enough room for a preview of what's inside and communicates which service tiers that demo showcases. The visitor should know what they're entering before they click. These sections are the primary entry point into each demo.

7. **Kill DemoNav** — Remove the persistent DemoNav bar from demo pages. Set up demo entry so browser back navigation returns to the correct homepage spotlight section (anchor-based scroll positioning or history state). If cross-demo navigation is needed, put it in the demo page footer or at the end of the demo flow, not in a persistent bar.

8. **Kill `/demo` landing page** — The homepage spotlight sections replace it entirely. The `/demo` route can redirect to `/#demos` or be removed.

**Constraints:**

- All existing data layer events must continue firing correctly through the architecture change.
- The ambient bubbles must respect `prefers-reduced-motion`.
- The full-page flip must work on mobile (not just desktop). Consider a slide-up full-screen view on mobile if a literal flip animation doesn't translate.
- The event stream SSE connection (Phase 2) and pipeline event schema stay unchanged — only the presentation layer changes.

**Why this is Phase 9A:** Everything in 9B–9D depends on the under-the-hood architecture and the homepage restructuring. The flip mechanic, ambient bubbles, and DemoNav removal are architectural foundations.

---

## Phase 9B — E-Commerce Demo: Tiers 2 & 3 (Data Infrastructure + Business Intelligence)

**Goal:** Transform the e-commerce demo from "events fire when you click stuff" into a progressive showcase of Tier 2 (Data Infrastructure) and Tier 3 (Business Intelligence). Each page in the checkout funnel demonstrates a different Tier 2 deliverable. The confirmation page pivots to Tier 3 with actionable dashboard insights. External BI tool integration (Looker Studio / Metabase) is demonstrated here.

**Context:** The e-commerce demo has the most page depth (listing → detail → cart → checkout → confirmation) making it the natural home for showing how data transforms at each step. The visitor doesn't just see events fire — they see what happens to the data after it fires.

**Deliverables:**

1. **Product listing underside: Campaign Taxonomy** — When the visitor views the under-the-hood layer on the product listing page, show how Automated Campaign Taxonomy cleaned up the UTM parameters that brought them here. "You arrived via `meta_prospecting_lal_tuna_q1` — the AI classified this as Meta / Prospecting / Lookalike." Show the raw → classified mapping. This demonstrates the Phase 5 AI.CLASSIFY model in a tangible, visitor-specific context.

2. **Product detail underside: Staging Layer** — Show the `product_view` event being flattened and enriched in the staging layer. Visualize the raw event → `stg_events` transformation: field extraction, type casting, session stitching. The visitor sees their own event being processed.

3. **Cart underside: Data Quality Framework** — Show the data quality assertions running on their `add_to_cart` event. "This event passed schema validation, null checks, and volume anomaly detection." Visualize the Dataform assertions from Phase 5 as a live checklist. If an assertion would theoretically fail, show what that looks like.

4. **Checkout underside: Warehouse Write** — Show the real-time BigQuery write. The event flowing from sGTM → Pub/Sub → BigQuery `events_raw` table. Visualize the row being written with all 51 columns. This is the moment the data lands in the warehouse.

5. **Confirmation page: Tier 3 pivot** — The visitor has seen how data is captured and structured. Now show what it tells you. Embed a dashboard preview with: funnel metrics (conversion rate by channel, drop-off at each stage), AOV trends, and an actionable insight: "Your checkout completion rate is 83.4% — visitors who see related products on the detail page convert at 2.3x the rate. Reducing the cart-to-checkout drop-off by 5% would add $14k in monthly revenue." This is BI doing what BI is supposed to do — telling you where the money is.

6. **Looker Studio / Metabase integration** — Build the e-commerce executive dashboard in Looker Studio and/or Metabase, connected to the BigQuery mart tables from Phase 5. Embed or deep-link from the confirmation page under-the-hood view. This demonstrates both BI tool options as referenced in the Tier 3 service description.

7. **Services page cross-links** — Add contextual links from the Tier 2 service description to the ecommerce funnel: "See how Dataform transforms raw add_to_cart events into the mart tables that power checkout analytics — walk through the Tuna Shop funnel." Add Tier 3 link to the confirmation page: "See what 18 months of e-commerce data looks like when it's properly instrumented and dashboarded."

**Constraints:**

- The underside content must use real data from the visitor's session where possible (their actual UTM params, their actual events) and simulated/mock data where the visitor hasn't generated enough history.
- The Looker Studio / Metabase dashboards connect to real BigQuery mart tables, not mock data.
- The existing e-commerce demo flow (product listing → cart → checkout → confirmation) stays functionally unchanged. The under-the-hood layer adds depth, it doesn't change the demo UX.

**Why this is Phase 9B:** The e-commerce demo has the most funnel depth. It's the natural first demo to build because it exercises every under-the-hood feature (taxonomy, staging, quality, warehouse write, dashboards) in sequence.

---

## Phase 9B-infra — Metabase Deployment

**Goal:** Stand up a self-hosted Metabase instance on GCP that can serve BI dashboards built on the Phase 5 BigQuery mart tables. This is the prerequisite infrastructure for Phase 9B deliverable 6 (embedding a Metabase dashboard in the confirmation page under-the-hood view). Authored as a discrete mini-phase because it is infrastructure work with no application-layer deliverables, and because it must complete before 9B deliverable 6 can ship.

**Context:** Metabase runs as a Cloud Run container backed by a Cloud SQL Postgres app DB, reachable only via a Google-managed load balancer with IAP in front. IAP restricts access to a whitelisted set of Google accounts (single-user deployment initially). Metabase queries BigQuery via a dedicated dataset-scoped read-only service account. The full deployment specification — pinned versions, naming conventions, per-task evaluator checks, cost expectations, and open decisions — lives in `docs/input_artifacts/metabase-deployment-plan.md`. Scripts and runbook land at `infrastructure/metabase/`.

**Deliverables:**

1. **Task 1 — Cloud SQL Postgres app DB:** Idempotent `setup-cloudsql.sh` that creates a `metabase-app-db` Postgres 15 instance (`db-f1-micro`, us-central1), `metabase` database and user, daily automated backups with 7-day retention, point-in-time recovery, and a generated password stored in Secret Manager (`metabase-db-password`). Also provisions a $100/month project-level budget alert. Uses Cloud SQL Auth Proxy (private IP only, no public ingress).

2. **Task 2 — Service accounts and IAM:** `setup-iam.sh` provisions two service accounts. `metabase-runtime` (Cloud Run identity) gets `cloudsql.client` and secret-scoped `secretmanager.secretAccessor`. `metabase-bigquery` (Metabase→BQ identity) gets `bigquery.dataViewer` scoped to `iampatterson_marts` only plus project-level `bigquery.jobUser`. Generates a JSON key for `metabase-bigquery`, uploads to Secret Manager as `metabase-bq-sa-key`, deletes the local copy. Generates the Metabase encryption key once and stores as `metabase-encryption-key` with a DO NOT REGENERATE warning (losing it invalidates the encrypted BQ credentials in the app DB).

3. **Task 3 — Cloud Run service deployment:** Templated `cloudrun.yaml` plus idempotent `deploy.sh`. Pinned Metabase image (no `:latest`), 2Gi/1 CPU, `min-instances=1` (warm), `max-instances=3`, 300s timeout, concurrency 10, gen2 execution environment. Cloud SQL connected via `--add-cloudsql-instances`. Ingress locked to `internal-and-cloud-load-balancing` — the `.run.app` URL is unreachable. All environment variables sourced from Secret Manager or hardcoded constants; `MB_DB_TYPE=postgres` is explicitly set to prevent H2 fallback.

4. **Task 4 — Environment variable documentation:** `.env.example` documenting every variable in Task 3's table — what it does, where it comes from, and critical warnings (notably the encryption key regeneration warning). No real secret values in the file. This is the contract for anyone rebuilding the setup from scratch.

5. **Task 5 — Load balancer and custom domain:** `setup-domain.sh` provisions the external HTTPS load balancer (serverless NEG → backend service → URL map → target HTTPS proxy → global forwarding rule with reserved static IP), Google-managed SSL cert for `bi.iampatterson.com`, and prints the DNS A record to configure manually at the registrar. Polls cert status and exits when ACTIVE. Required for IAP, which only attaches to load-balancer-fronted services on Cloud Run.

6. **Task 6 — IAP configuration:** `setup-iap.sh` creates an OAuth 2.0 client, stores ID and secret in Secret Manager, enables IAP on the Metabase backend service, and grants `roles/iap.httpsResourceAccessor` to an allowlist array defined at the top of the script. The OAuth consent screen is a one-time manual setup step documented in the README. Re-running the script reconciles the allowlist (additive). Verification: `.run.app` stays private; `bi.iampatterson.com` redirects to Google SSO.

7. **Task 7 — Metabase initial setup runbook:** README section walking through the one-time UI configuration that cannot be scripted: create admin account, enable 2FA, disable public sharing and signups, optionally enable Google auth for auto-provisioning allowlisted IAP users, and add the BigQuery data source using the `metabase-bq-sa-key` secret as the service account credential (filtered to `iampatterson_marts`). Goal: anyone rebuilding from scratch can follow end to end.

8. **Task 8 — Backup and upgrade runbooks:** `backup.sh` for on-demand Cloud SQL backups tagged with timestamp and Metabase version. `upgrade.sh` takes a version argument, runs a backup first, requires explicit confirmation that release notes have been reviewed, updates the pinned image tag, redeploys, polls `/api/health`, and runs a smoke query against the BigQuery connection. README sections cover backup/restore, upgrade, BigQuery SA key rotation (annual), allowlist additions, and rollback from a bad upgrade.

**Constraints:**

- No image tags may use `:latest`. Every Docker/container version is pinned explicitly.
- Cloud Run ingress must remain locked to `internal-and-cloud-load-balancing`. The `.run.app` URL is never publicly reachable.
- The BigQuery service account must be dataset-scoped (`iampatterson_marts` only) — no project-level `dataViewer`.
- `MB_ENCRYPTION_SECRET_KEY` is generated once and never rotated. Losing it invalidates encrypted credentials in the app DB.
- Every script must be idempotent (safe to re-run).
- Each task is a discrete commit. The evaluator subagent must pass the task's checks before the next task begins. Tasks do not parallelize.

**Why this is Phase 9B-infra (not a Phase 9B deliverable):** This is standalone infrastructure work with no Next.js application code. It stands up a new GCP service, configures IAM, provisions a load balancer, and enables IAP — scope that is larger than a single 9B deliverable but smaller than a full numbered phase. Treating it as a dedicated sub-phase keeps the deployment discipline (task-by-task evaluator gating) visible in the phase tracker and ensures it is not conflated with the application-layer work of 9B deliverable 6 (which embeds the resulting Metabase instance into the confirmation page under-the-hood view).

---

## Phase 9C — Lead Gen Demo: Tier 1 Privacy/Consent + Tier 3 BI + AI Narrative Reporting

**Goal:** Transform the lead gen demo into the privacy and consent governance showcase. This is the only demo where the visitor types PII into form fields — making consent enforcement tangible rather than abstract. The thank-you page pivots to Tier 3 BI and AI-powered narrative reporting.

**Context:** Every MarTech prospect has been told "consent state is enforced server-side" by a vendor. Nobody has ever shown them. The lead gen demo can: deny marketing consent, fill in the form, and watch the under-the-hood view show the lead event flowing to BigQuery and GA4 but being blocked from Meta and Google Ads. Grant consent, submit again, and see the full routing with hashed PII payloads. This is a live demonstration of Cookiebot → Consent Mode v2 → sGTM enforcement that no competitor's portfolio can match.

**Deliverables:**

1. **Form interaction underside: Consent & Privacy visualization** — As the visitor fills in the partnership inquiry form, the under-the-hood view shows what's actually happening to their data in real time: which consent signals are active (analytics, marketing, ad_user_data, ad_personalization), how consent state determines which platforms receive the lead event, what happens to the email address (hashed before it hits BigQuery, redacted entirely if marketing consent is denied), how `ad_user_data` consent specifically governs whether user-provided data flows to Meta CAPI and Google Ads Enhanced Conversions.

2. **Live consent enforcement demonstration** — The visitor can interact with the Cookiebot consent banner to change their consent state, then submit the form and see the difference in the under-the-hood routing. With marketing consent denied: lead event flows to BigQuery and GA4 but is blocked from Meta CAPI and Google Ads EC. With consent granted: full routing with hashed PII payloads visible. Show the simulated Meta CAPI payload (already built in Phase 6 sGTM templates) with the hashed `user_data` fields. This makes the Tier 1 privacy promise concrete.

3. **Thank-you page: Tier 3 BI** — Lead funnel dashboard (visits → form starts → submissions → qualified leads), cost per qualified lead by channel, lead quality distribution. Embed as a dashboard preview with narrative framing.

4. **Automated Narrative Reporting (AI)** — Wire the Phase 5 RAG pipeline to generate written summaries for the lead gen business model. The thank-you page under-the-hood view shows a sample AI-generated weekly report: "This week, the Tuna Partnerships pipeline generated 47 qualified leads at $23 average CPL. Meta prospecting drove the highest volume (18 leads) but Google branded search produced the lowest CPL ($12). Qualification rate improved 3% week-over-week..." Viewable as part of the under-the-hood experience. Schedule the RAG pipeline via Cloud Scheduler to produce fresh reports.

5. **Services page cross-links** — Tier 1 links to the lead gen form with: "See how Consent Mode v2 enforcement works in practice — submit a partnership inquiry and watch the consent-gated routing in real time." Tier 3 AI link: "See what Automated Narrative Reporting looks like — here's what it produced for the Tuna Partnerships lead pipeline this week."

**Constraints:**

- The consent enforcement demonstration must work with the actual Cookiebot integration, not a simulated consent banner. The visitor's real consent state drives the routing visualization.
- PII handling visualization must not expose actual PII — show hashed values and the hashing process, not cleartext.
- The RAG pipeline uses the Phase 5 BigQuery infrastructure (vector embeddings, stored procedures). No external AI infrastructure.

**Why this is Phase 9C:** The lead gen demo is the shortest in page count but the most conceptually dense. It carries Tier 1 privacy, Tier 3 BI, and AI narrative reporting. Building it after the ecommerce demo means the under-the-hood architecture is proven and the BI integration patterns are established.

---

## Phase 9D — Subscription Demo: Tier 4 (Attribution & Advanced Analytics)

**Goal:** Transform the subscription demo into the attribution and advanced analytics showcase. Subscription businesses live and die by understanding which channels produce high-LTV subscribers, not just which channels produce the most trials. This demo houses multi-touch attribution, cohort analysis by acquisition source, and the "what's actually working" narrative — the most analytically sophisticated tier.

**Context:** The subscription model is the natural home for attribution because the value of a subscriber is realized over time (LTV), not at the point of conversion. Last-click attribution massively over-credits branded search and under-credits upper-funnel channels that drive awareness. This is the demo that makes the discrepancy visible and explains why it matters.

**Deliverables:**

1. **Multi-touch attribution model (Dataform)** — Build Shapley value attribution across the simulated channel mix for the subscription business model in Dataform. Comparison view showing MTA results versus last-click versus platform-reported attribution, making the discrepancies visible. Build on the BigQuery mart tables from Phase 5.

2. **Attribution comparison visualization** — The subscription demo under-the-hood view shows the attribution comparison: three columns (Shapley, last-click, platform-reported) showing how credit allocation differs for the same conversions. Highlight the channels where the discrepancy is largest (typically: upper-funnel paid social gets more credit under Shapley, branded search gets less). Include narrative explanation accessible within the demo — not just showing numbers but explaining to a non-technical prospect why these results differ from what their ad platform tells them.

3. **Cohort retention by acquisition source** — Visualize cohort retention curves segmented by the channel that acquired the subscriber. Show that a channel producing fewer trials but higher retention (higher LTV) is more valuable than a channel producing many trials with high churn. This is the "what's actually working" insight.

4. **LTV by channel analysis** — Compute and visualize customer lifetime value by acquisition channel using the Phase 5 `mart_customer_ltv` and `mart_subscription_cohorts` tables. Show how LTV-informed budget allocation differs from volume-based allocation.

5. **Lightweight MMM or geo-lift demonstration** — If the background generator data supports geographic segmentation: build a lightweight media mix model or geo-lift analysis using the simulated historical data. This may be a static analysis rather than a live model. If geo data is insufficient, present as a methodology explanation with the subscription data as a case study for what MMM would answer.

6. **Services page cross-links** — Tier 4 links to the subscription demo: "See how Shapley value attribution redistributes credit across channels compared to last-click and platform-reported — using 18 months of subscription data from the Tuna Box demo." Link to the cohort retention visualization: "See which channels produce subscribers who stay versus subscribers who churn."

**Constraints:**

- The attribution models must run in Dataform on the BigQuery mart tables. No external analytics tools or Python notebooks — the demonstration value is that this runs inside the warehouse.
- The comparison visualization must clearly communicate to a non-technical audience. Use progressive disclosure: simple comparison first, methodology detail available for those who want it.
- The subscription demo flow (plan selection → signup → dashboard) stays functionally unchanged. Attribution content lives in the under-the-hood view and dashboard previews.

**Why this is Phase 9D:** Attribution requires the most data depth, the most analytical sophistication, and benefits from all preceding phases. The e-commerce and lead gen demos establish the under-the-hood patterns; the subscription demo adds the deepest analytical layer on top.

---

## Phase 10 — Polish, Performance & Launch Prep

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

## Phase 11 — Operational Readiness & Maintenance Infrastructure

**Goal:** Build the monitoring, alerting, and operational tooling needed to keep the full stack healthy in production without manual babysitting.

**Deliverables:**

1. **Cloud Monitoring dashboard:** Single pane covering all Cloud Run services (sGTM, event-stream, data-generator), Pub/Sub throughput and dead-letter queue depth, BigQuery slot usage and costs, SSL certificate status
2. **Alerting policies:** Service health (5xx error rate > threshold), event pipeline latency (Pub/Sub → SSE delivery time), sGTM container crash loops, BigQuery daily cost threshold, Dataform run failures, SSL certificate expiry warnings
3. **Uptime checks:** Automated health probes for sGTM (`/healthy`), event-stream service, and the Vercel-hosted site. Notification channels (email, Slack, or PagerDuty integration)
4. **sGTM container lifecycle:** Automated or documented process for updating the `gtm-cloud-image` when Google releases new versions. Version pinning strategy (`:stable` vs specific tags)
5. **Data retention and cost controls:** BigQuery partition expiration policies on raw event tables, Cloud Storage lifecycle rules on AI export bucket, budget alerts on the GCP billing account
6. **Operational runbook:** Documented procedures for common failure modes — sGTM not responding, event pipeline backlog, Dataform assertion failures, data generator stuck/failing, SSL cert renewal failure. This doubles as portfolio content demonstrating operational maturity
7. **Log aggregation:** Structured logging across all Cloud Run services routed to Cloud Logging with log-based metrics for error patterns. Log retention policy aligned with data retention requirements
8. **Dependency update process:** Documented cadence for updating Node.js runtime, Next.js framework, Cloud Run base images, and npm dependencies. Security advisory monitoring

**Why this is Phase 11:** Everything must be built and running before you can instrument its operations. This phase turns a working demo into a production system you can confidently hand off or maintain long-term. It's also a differentiator — most portfolio sites don't demonstrate operational thinking.

---

## Dependencies & Risk Notes

- Phases 1-3 can be built without any simulated data — they work on real visitor events to the consulting site
- Phase 4 (background generator) is the critical path item for Phases 5-8. If it slips, everything downstream slips
- The Dataform models built in Phase 5 are directly reusable for real client work — this is not throwaway code
- Phase 9A (core architecture) is the critical path for 9B–9D. The full-page flip mechanic, ambient bubbles, and DemoNav removal must be stable before building demo-specific underside content
- Phase 9B should be built first among the demo phases — it exercises every under-the-hood feature in sequence and establishes patterns for 9C and 9D
- Phase 9D (attribution) requires the most analytical depth and may need additional Dataform models beyond what Phase 5 built. Shapley value computation and cohort-by-channel analysis should be planned as Dataform extensions
- The full-page flip interaction is the highest-risk UX element in the project. It must work on mobile. Consider progressive enhancement: the underside content is valuable even without the flip animation. Build the content first, refine the animation after
- BigQuery managed AI functions (AI.CLASSIFY, AI.IF) are currently in public preview. If they reach GA during development, the implementation stays the same. If Google changes the API surface during preview, Dataform models may need adjustment
- sGTM is self-hosted on Cloud Run (migrated from Stape in Phase 6). The `gtm-cloud-image` must be kept up to date when Google releases new versions. Cloud Run costs are negligible for current traffic volume but should be monitored
- The demo-specific underside content is the most scope-creep-prone area. Each demo's under-the-hood view could absorb unlimited polish. Define a "good enough" standard for the visualization fidelity and stick to it — the narrative framing matters more than pixel-perfect pipeline diagrams

---

## Technical Architecture Overview

*Frontend:* Next.js, TypeScript, Tailwind CSS. The site, three demo front-ends, and the flip-the-card overlay all live within a single Next.js application.

*Instrumentation Layer:* Cookiebot CMP → client-side GTM data layer → sGTM on Stape → event routing to GA4, Meta CAPI (simulated for demos), Google Ads Enhanced Conversions (simulated for demos), and BigQuery.

*Real-Time Event Pipeline:* sGTM → Pub/Sub topic → Cloud Run WebSocket service → browser via Server-Sent Events or WebSocket, scoped by session ID.

*Data Infrastructure:* BigQuery (raw → staging → marts via Dataform), BigQuery Data Transfer Service and/or Airbyte for simulated platform data, background data generator on Cloud Run.

*BI Layer:* Looker Studio and/or Metabase dashboards running on Dataform mart tables, embedded or linked from the demo back-end views.

*AI Layer:* BigQuery managed AI functions (AI.CLASSIFY, AI.IF) for campaign taxonomy, RAG pipeline for narrative reporting, all native to BigQuery.
