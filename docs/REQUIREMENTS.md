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

## Phase 9A-redesign — Editorial Homepage, Services, and Under-the-Hood Overlay

**Goal:** Reskin the homepage, services page, and under-the-hood overlay per the editorial direction in `docs/input_artifacts/iampatterson-com/` — serif-forward magazine-grid on paper, terminal/CRT vocabulary in the overlay. Persimmon `#EA5F2A` on paper flipping to phosphor amber `#FFA400` when the overlay boots (~260ms hold). Prototype copy is kept verbatim where strong; current-site copy is pulled in only where the prototype is thin or placeholder. Demo front-ends are out of scope — each gets a custom design in a later phase. All existing instrumentation (data layer events, `useEventStream`, ambient event bubbles from Phase 9A, session ID mechanism, SSE pipeline) is preserved and rewired, not rebuilt.

**Context:** The clean-slate palette finalized at the end of Phase 9A lets the measurement pipeline carry the visual weight, but the resulting site is restrained to the point of feeling generic. The editorial redesign reintroduces a single restrained accent with a deliberate on/off relationship to the under-the-hood state: persimmon on the marketing surface, phosphor amber when the overlay boots. The redesign also upgrades the overlay from a full-page view into a terminal/CRT aesthetic that earns the "under the hood" metaphor more aggressively than the current implementation.

**Deliverables:**

1. **Design tokens + typography** — Instrument Serif added to the font stack alongside existing Plus Jakarta Sans + JetBrains Mono; persimmon (`#EA5F2A`) / phosphor amber (`#FFA400`) accent tokens wired into Tailwind; `--accent` CSS variable driven by overlay open state via `OverlayProvider`; neutral palette aligned with the current clean-slate paper/ink scale.

2. **Editorial chrome** — Header with `SessionPulse` button (opens overlay); `LiveStrip` horizontal ticker below the header exposing SESSION · STACK · CONSENT · PIPELINE · DASHBOARDS · ATTRIB fields; `MobileSheet` menu overlay; editorial 4-column footer with brand, pages, demos, and under-the-hood link columns.

3. **Homepage hero masthead** — "I build measurement infrastructure." set in Instrument Serif display; deck with lede + body copy; primary (open overlay) / ghost (explore demos) CTAs.

4. **Pipeline section** — 5-stage animated pipeline (Browser → Client GTM → sGTM → BigQuery → Dashboards) with dashed connector rule, packet motion, and a live log feed rendered from the real `useEventStream` hook (not mocked); "Watch it live" button opens the overlay.

5. **Demos section** — Horizontal-scroll card track on mobile/tablet (snap points) with swipe-indicator bars; 3 demo cards linking to the existing `/demo/ecommerce`, `/demo/subscription`, `/demo/leadgen` routes. No changes to the demo pages themselves.

6. **Services teaser + full Services page** — Homepage teaser lists 4 tiers with short per-tier descriptions linking to `/services`; Services page has sticky tier-nav sidebar with scroll-spy, per-tier core / optional / summary blocks using prototype copy, and a closer section ("Not sure where you'd start? Watch it run first."). Tier copy audited against current-site services content to pull in any detail the prototype omitted.

7. **Proof section** — "Evidence · What the infrastructure has done" kicker; large serif headline; 3-metric grid (2.5M audience · $45K revenue · 24/7 live events) with tag/metric/context per card.

8. **Final CTA** — "Watch it run first. Then hire me." section with `contact — ian@iampatterson.com` eyebrow, primary (open overlay) / ghost (contact) CTAs.

9. **Under-the-hood overlay redesign** — Full-page terminal/CRT overlay with 4 tabs (Overview, Timeline, Consent, Dashboards); two-step boot (~260ms hold with accent flip orange → amber, then phase-on reveals panel contents) — boot plays only on the first overlay open of a browser session; subsequent opens within the same `sessionStorage` scope skip the hold and land directly in the on state; CRT flicker / bloom / scanlines layers as non-interactive siblings; backdrop click and "Back to site" button both close; Timeline tab wired to the real event stream via `useEventStream`; Overview/Consent/Dashboards panels structured around the existing Tier 1-3 narrative.

10. **Wiring & route integration** — All new surfaces live at the existing `/` and `/services` routes; `OverlayProvider` context retargeted at the new full-page overlay; demo routes untouched; overlay remains reachable on `/demo/ecommerce/*` so the Phase 9B Tier 2 undersides keep working (pathname-specific Overview panel routes to `EcommerceUnderside`); ambient event bubbles from Phase 9A stay gated off `/demo/*` via `AmbientBubblesWrapper`; removed Phase 9A overlay components cleaned up.

**Constraints:**

- All existing data layer events must continue firing correctly through the architecture change. Event schemas unchanged.
- The SSE pipeline from Phase 2 and the `useEventStream` hook stay unchanged — only the presentation layer changes.
- `prefers-reduced-motion` disables the accent-flip transition, packet motion, CRT flicker, and scroll-reveals.
- No changes to demo pages or the three demo routes (custom designs are a separate future phase).
- Phase 9B is frozen while 9A-redesign is in flight, including the 6a manual-apply task. 9B resumes cleanly once 9A-redesign completes.

**Why this is 9A-redesign (not 9A-v2 or Phase 12):** The redesign reshapes what the Phase 9A surfaces look like, not what they do. Numbering it as a suffix to 9A keeps the phase history honest — original 9A shipped what it promised; this is a redesign pass over its surfaces.

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

6a. **Metabase dashboards as code** — Build a single "E-Commerce Executive" dashboard in the Metabase instance (Phase 9B-infra) with six questions backed by the BigQuery mart tables from Phase 5:

     1. **Funnel conversion by channel** — grouped bar (four metrics per channel — sessions, product_view, add_to_cart, purchase), so stage-to-stage drop-off is visible as adjacent bar heights rather than hidden inside a stack. Grouped by `utm_source`. Source: `mart_session_events`.
     2. **AOV trend (90 days)** — line chart of daily average order value. Source: `mart_session_events`.
     3. **Campaign spend vs. revenue (ROAS)** — grouped bar chart with two metrics (spend, revenue) per campaign; the implicit ROAS ratio is revenue-bar-height / spend-bar-height. AI-classified taxonomy labels from Phase 5 on the x-axis. Source: `mart_campaign_performance`.
     4. **Revenue share by channel** — donut chart of attributed revenue by `utm_source`, most recent month of available data. (`mart_channel_attribution` is month-grained; a 30-day rolling window would require rebuilding the mart or switching sources.) Source: `mart_channel_attribution`.
     5. **Customer LTV distribution** — histogram of per-customer total revenue with channel overlay. Source: `mart_customer_ltv`.
     6. **Daily revenue trend (30d)** — line chart of daily total purchase revenue. Source: `mart_session_events`.

     Dashboards and questions are authored as versioned YAML specs in `infrastructure/metabase/dashboards/` and applied to the live instance via an idempotent `apply.sh` script that drives the Metabase REST API. The specs are the source of truth — any asset authored directly in the Metabase UI without a corresponding spec is drift. Looker Studio is out of scope; Metabase is the canonical BI tool for this site.

6b. **Confirmation-page signed embed** — On `/demo/ecommerce/confirmation`, render three live Metabase iframes inline below the order details (replacing the static Tier 3 mocks that deliverable 5 landed), ordered by how directly each chart ties back to the visitor's just-placed order:

     1. **Daily revenue trend (30 days)** — *"Today's revenue. Orders like yours roll into this bar as they complete."* Most immediate: the visitor's purchase just bumped today's bar. Copy hedged from the original "Your order is in there" so the caption holds for visitors arriving via the Services cross-link (no purchase event fired) as well as organic demo-funnel arrivals.
     2. **Funnel conversion by channel** — *"You just converted. Out of every 100 visitors from your channel, about 3 get here."* Contextualizes the purchase in the denominator.
     3. **AOV trend (90 days)** — *"Your order was $X. Here's where it lands on the 90-day AOV trend."* Zooms out to trend. `$X` is interpolated from `searchParams.total`; the benchmark ($Y) is left implicit — the chart itself shows it. Falls back to a generic "Your order against the 90-day AOV trend." when `$X` is missing, zero, or non-finite.

     Short narrative prose between iframes frames each chart with the visitor's purchase as the connecting thread — the confirmation page is the Tier 3 *payoff* surface in the ecommerce narrative, distinct from the Tier 2 *plumbing* content that lives in each funnel step's overlay. Iframes are signed via Metabase's static-embed feature: a Next.js Server Component mints short-lived (10-minute) HS256 JWTs keyed by `MB_EMBEDDING_SECRET_KEY`, with card IDs sourced from the `METABASE_EMBED_CONFIG` env var (a Vercel mirror of the Secret Manager `metabase-embed-config` entry produced by `apply.sh --publish-embed-config`). The `/embed/*` URL-map path split from 6a already bypasses IAP, so anonymous visitors load the iframes directly.

     The three non-embeddable questions (ROAS by campaign, Revenue share by channel, Customer LTV distribution) live in the overlay's Dashboards tab on the confirmation route as summary cards with a deep-link into the IAP-gated `/dashboard/2` — preserving the overlay's "additional depth" role without duplicating the inline embeds.

7. **Services page cross-links** — In each tier summary box on `/services`, add a "See it live →" link that grounds the tier description in the matching demo surface:

     - Tier 2 summary → `/demo/ecommerce` (walks through the Tier 2 plumbing at each funnel step)
     - Tier 3 summary → `/demo/ecommerce/confirmation` pre-filled with a demo order so the inline BI embeds are meaningful on arrival

     Styling matches the editorial ghost links used elsewhere on the page. Copy is "See it live →" verbatim; the tier summary body already does the storytelling.

**Constraints:**

- The underside content must use real data from the visitor's session where possible (their actual UTM params, their actual events) and simulated/mock data where the visitor hasn't generated enough history.
- Metabase dashboards connect to real BigQuery mart tables in `iampatterson_marts`, not mock data.
- The `infrastructure/metabase/dashboards/` YAML specs are the source of truth. `apply.sh` is idempotent; re-running it reconciles Metabase to match the specs.
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

## Phase 9E — Navigation & Overlay Pivot

**Goal:** Reframe the site as one world in two states by making the `SessionPulse` the primary navigation affordance, restructuring the under-the-hood overlay around a new default Session State tab, rebuilding the homepage pipeline section as a progressive bleed-through reveal, collapsing the homepage Demos section to a single ecommerce section, and removing the subscription and lead gen demos from the site. The ecommerce demo's Tier 2/3 reveal mechanics are rebuilt to the native-reveal pattern language in Phase 9F, which **ships jointly with 9E** — see "Release coupling" below.

**Context:** UAT on the shipped Phase 9A-redesign + Phase 9B stack found that the three-surface site (editorial pages, overlay, demo mini-sites) feels disjointed. The conventional header nav doesn't reflect the product. The overlay is a destination visitors toggle in and out of, not a continuous state. The ecommerce demo forces visitors through pretend funnels with overlay interruptions. This pivot makes instrumentation the nav (the `SessionPulse` is the entry point; the overlay is the portal), introduces progressive reveal so opening the overlay feels like a continuation rather than a toggle, and collapses the site to one coherent demo so the Phase 9F rebuild of the ecommerce demo's native-reveal pattern isn't competing with two old-pattern demos alongside it. Full design rationale, principles, and flows are in `docs/UX_PIVOT_SPEC.md`. The pipeline-section redesign is specified in the hi-fi prototype bundle at `docs/input_artifacts/design_handoff_pipeline/`.

**Release coupling — 9E and 9F ship together.** 9E does not ship standalone. Shipping 9E alone would land the new nav / overlay / Session State tab / pipeline reveal on top of today's overlay-based ecommerce reveals — exactly the disjointed experience this pivot exists to fix, only with fewer demos. The two phases are authored and evaluated as separate blocks for tracking clarity, but the production release cuts one branch when both are dev-complete and dual-evaluator-passing. This coupling also resolves the Dashboards-tab disposition: 9E deliverable 2 removes the overlay's Dashboards tab, and 9F moves the three non-embeddable Metabase questions (ROAS, Revenue share, LTV) inline on `/demo/ecommerce/confirmation` so they're never stranded between releases. *Shipping-risk acknowledgment:* one larger release cut is harder to bisect for regressions than two smaller ones, and carries a larger dual-evaluator surface. Mitigations: each phase's deliverables are reviewed independently by both evaluators before the joint cut, regression-test coverage ratchets up with each block (not only at the release), and the joint-ship branch sits in a pre-release state long enough for a final whole-site UAT pass before production promotion.

**Strategic framing — what this pivot costs, honestly.** This is the third redesign pass. The site currently demonstrates Tier 1 (privacy / consent routing, partially), Tier 2 (ecommerce plumbing), Tier 3 (ecommerce BI), and stubs of Tier 4 (attribution — shipped in mocks only). The 9E / 9F pivot shrinks the demonstrated tier coverage to 2 + 3 until the subscription and lead gen demos are rebuilt in later phases. The loss is real: 9C's consent-enforcement narrative (deny marketing consent → see routing change live) is arguably the strongest Tier 1 proof on the whole site, and 9D's Shapley attribution is the Tier 4 payoff. Neither currently exists in a shipped state. The trade is accepted because the past two redesigns absorbed scope trying to deliver all four tiers at once and ended up with three inconsistent demos. One coherent demo that demonstrates Tiers 2 + 3 end-to-end is stronger proof than three demos at inconsistent polish levels. The reintroduction of Tier 1 and Tier 4 narratives happens as separate, dedicated later phases — not by speeding up 9F or folding them into 9E. This framing is an explicit counter-temptation note to future sessions.

**Deliverables:**

1. **Header navigation pivot** — Remove the conventional header nav (Home / Services / About / Contact / Demos dropdown). The header carries `SessionPulse` (primary nav affordance; opens the overlay) and the brand wordmark. `LiveStrip` is unchanged. Desktop treatment: `SessionPulse` sits where a primary nav's first link would sit (left of center or adjacent to the brand wordmark), minimum 44×44px target, a stronger pulse than mobile, a hover affordance upgrade (border intensification, `↗` indicator glow, tooltip-style `NAV · UNDER THE HOOD` label in mono/amber). First-session hint: a one-time soft amber pulse ring expands outward from the `SessionPulse` after ~3s of homepage idle and auto-clears after ~10s of continued inactivity if not dismissed sooner. "Homepage idle" is defined as: no `scroll`, no `click` (pointer or synthesised), no `keydown`, and no `pointermove` events on `document` since the page mounted. The hint dismisses on (a) any `scroll` event (enum value `scroll`), (b) a click on the `SessionPulse` element itself (enum value `click_session_pulse`), (c) any other click on the page — any `click` whose target is not the `SessionPulse` element or its descendants (enum value `click_outside`), or (d) the 10s auto-clear timer elapsing (enum value `timeout`). The four enum values match `NavHintDismissedEvent.dismissal_mode` in deliverable 9; listener surface and enum are the same surface named twice. The hint is gated to once-per-session via `sessionStorage` at key `iampatterson.nav_hint.shown` (mirrors the naming convention established by `iampatterson.overlay.booted` in `src/components/overlay/under-the-hood-view.tsx`); the hint is homepage-entry-scoped: it fires on the visitor's first homepage render within the session regardless of where they entered the site, and the `sessionStorage` gate is set only when the hint actually renders. A visitor who enters on `/services` and later navigates to `/` sees the hint on that first homepage visit; the gate then prevents re-firing for subsequent homepage visits in the same session. Under `prefers-reduced-motion` the hint becomes static text ("← menu · under the hood") that fades after 6 seconds. The 10s auto-clear on the animated hint is a deliberate fortification of the spec's silence on how the un-dismissed animated pulse eventually clears (the spec specifies only that it "dismisses permanently on any click or scroll"); a bounded timeout prevents an idle tab from carrying the pulse ring forever. Do not "correct" this back to 6s — 6s is specifically for the reduced-motion static-text fade; the animated hint's auto-clear is longer because the visitor is more likely to be reading. Mobile: `SessionPulse` in the top-right position where a hamburger would sit; same tap-to-open behavior. Mobile header retains today's sticky-on-scroll + subtle-scroll-shadow behavior unchanged — the nav pivot touches affordances and content, not scroll chrome. Both breakpoints: `SessionPulse` continues to render its self-demonstrating readout (`ses <last-6> · <N> evt`), and the live event count must continue to increment on user interaction — the ticking numerals are the primary signal that this surface is interactive and session-scoped, and removing them would defeat the nav-affordance case. Footer on every page carries the conventional nav links (Home / Services / About / Contact / Demos) as the cheap escape hatch and desktop-nav compensation. Remove `MobileSheet` entirely. Do not add a backup hamburger anywhere — the footer plus Session State tab are the designed escape hatches. See `docs/UX_PIVOT_SPEC.md` §3.1.

2. **Under-the-hood overlay restructure** — Default tab on open changes from Overview to Session State. Tabs in order: `Session State`, `Timeline`, `Consent`. Remove the `Overview` tab, the `Dashboards` tab, the `HomepageUnderside` component, and the `/demo/ecommerce/*` pathname-specific `EcommerceUnderside` routing — the overlay no longer shows per-page demo-specific content in 9E. CRT boot sequence, scanlines, amber accent, backdrop-click-to-close, "Back to site" button: unchanged. Retrofuturism pushed slightly further in the overlay chrome — active tab labels get terminal-style bracket framing (e.g. `[ SESSION STATE ]` for the active tab, plain for inactive); Timeline timestamps and event-names glow amber with page paths and parameter rows in warm cream; Consent tab unchanged in function. Body content across tabs stays warm cream for legibility — amber is reserved for headers, live data, status tags, and progress bars. See `docs/UX_PIVOT_SPEC.md` §3.2.

3. **Session State tab (new)** — The overlay's default landing surface and the primary portal to Services / About / Contact. Layout (top → bottom): session header block (short session ID, session-start time, current page in amber mono); event coverage summary with ASCII-style progress bar (e.g. `[████░░░░░░░░░░░░] 6/22 event types` — the denominator is derived at module init from `DATA_LAYER_EVENT_NAMES` in `src/lib/events/schema.ts` (22 post-9E deliverable 9; whatever the live schema count is at render time). Do not hardcode `22` or `16` anywhere in the rendering path — read from the derivation. **Bar width is fixed at 16 cells regardless of the denominator, with fill computed as `Math.round(fired / total * 16)` rounded to the nearest cell** so the bar's visual resolution is consistent across all rendering sites — ASCII bars anywhere else in the overlay use the same 16-cell convention) and a grid of event-type chips (fired amber, unfired dimmed) so visitors can see at a glance what they haven't explored; ecommerce demo funnel rendered as a sequential `[OK]`/`[  ]` block covering `PRODUCT_VIEW` → `ADD_TO_CART` → `CHECKOUT` → `PURCHASE` with completion percentage below; consent summary (three-row compact readout pulled from the same source the Consent tab uses); portal section (terminal-styled `> SERVICES` / `> ABOUT` / `> CONTACT` links — each closes the overlay and routes); a contextual contact CTA that surfaces when the visitor has crossed a threshold (triggered >10 event types or reached checkout in the demo). **Contextual contact CTA behavior when deliverable 8 (contact-form ride-along) is deferred — the default treatment in 9E:** the threshold-gated contact CTA routes to `/contact` with no `session_state` query parameter and no hidden ride-along payload. It differs from the `> CONTACT` portal link in copy only (e.g. warmer, outcome-framed language like "Seen enough? →" vs. the neutral `> CONTACT`) and in its threshold gating, not in destination or payload. Fires `portal_click` with `destination: 'contact'` and a distinguishing `click_cta` emission with `cta_location: 'contact_cta_threshold'` (see deliverable 9). Do not ship a `session_state=1`-style query param that no receiver honors; the ride-along is a future-work surface. Retrofuture vocabulary: amber-glow headers, `█`/`░` ASCII bars, `[OK]` / `[  ]` / `[SKIPPED]` status tags, `─` separators, `>` prompt prefixes on list items, a subtle typing animation on first coverage-number render. See `docs/UX_PIVOT_SPEC.md` §3.3.

4. **Session State data model** — New `SessionState` shape persisted to `sessionStorage` at key `iampatterson.session_state`, scoped to tab lifetime (returning visitors start fresh; aligned with the existing `_iap_sid` cookie behavior). Fields: `session_id`, `started_at`, `page_count`, `events_fired` (name → count map), `event_type_coverage` (`fired[]`, `total[]`), `demo_progress.ecommerce` (`stages_reached[]`, `percentage`), `consent_snapshot` (`analytics` / `marketing` / `preferences`), `updated_at`. A single listener on the same data-layer source that populates `useDataLayerEvents` / `useLiveEvents` updates the blob on every event (the existing buffer is untouched). The coverage denominator is read at module init from the exported `DATA_LAYER_EVENT_NAMES` runtime array in `src/lib/events/schema.ts` — the single source of truth that stays in lockstep with the `DataLayerEvent` union via the compile-time `_AssertEventNamesInSync` sentinel (type-check fails if the array and union drift). Post-Phase-9E-deliverable-9 the array contains 22 distinct `event` string literals (the 16 pre-9E entries — `page_view`, `scroll_depth`, `click_nav`, `click_cta`, `form_field_focus`, `form_start`, `form_submit`, `consent_update`, `product_view`, `add_to_cart`, `begin_checkout`, `purchase`, `plan_select`, `trial_signup`, `form_complete`, `lead_qualify` — plus the 6 new 9E entries from deliverable 9: `nav_hint_shown`, `nav_hint_dismissed`, `session_pulse_hover`, `session_state_tab_view`, `portal_click`, `coverage_milestone`). **The derive-from-schema rule applies across the entire coverage path — no hardcoded `16` (or `22`) magic numbers anywhere in rendering, derivation, or test logic.** Deliverable 9 has landed in this phase (see commit `9903e8d`), so the denominator is 22 as of day one of deliverable 4's implementation; adding future events to the schema requires zero coverage-logic changes. The triangulation of correctness across the schema module, the compile-time sentinel, and the exhaustive-literal test (see the `_AssertEventNamesInSync` sentinel in `schema.ts` and the `DataLayerEvent union is exhaustive` test in `schema.test.ts`) means single-point drift is caught immediately and simultaneous three-way drift requires deliberate effort. Subscription and lead gen event types stay in the denominator even though their demos are out of scope — their unfired presence subtly communicates "more of the site exists." Demo-progress stages are monotonic within a session (stages cannot be un-reached). Trigger map for ecommerce funnel stages: `product_view` / `add_to_cart` / `begin_checkout` / `purchase` events drive the corresponding stages. Full `SessionState` TypeScript shape in `docs/UX_PIVOT_SPEC.md` §3.6.

5. **Pipeline section — progressive bleed-through reveal** — Rebuild the homepage pipeline section per the hi-fi prototype at `docs/input_artifacts/design_handoff_pipeline/`. Scroll-anchored bleed ramp math tied to the section's own height, not a viewport fraction: `enter = vh * 0.25`, `peak = vh * 0.95 - sectionHeight`, `p = 1 - clamp((rect.top - peak) / (enter - peak), 0, 1)`, `bleed = p²` (ease-in). Four absolutely-positioned non-interactive `aria-hidden` sibling layers read `var(--bleed)` every frame: `.bleed-scanlines` (horizontal CRT raster, vertical drift), `.bleed-phosphor` (amber bloom from the bottom, breathing), `.bleed-vignette` (darkened corners, curved-tube effect), `.bleed-rgb` (chromatic aberration band that sweeps top→bottom only at `hot` tier). Tier state machine: `warm` > 0.18, `hot` > 0.55, `peak hot` > 0.85 — React re-renders only when the tier class changes. Flicker bursts at tier ≥ 1 scheduled with delay `240 + (1 - bleed) * 2200 + rand() * 400` ms and duration `90 + rand() * 120` ms (bursts sharpen and come more often as bleed grows). Stage rotation on a 1800ms interval, wraps, disabled under `prefers-reduced-motion`. Session event log continues to feed from `useLiveEvents` (no new data source). `--bleed` writes happen in a `requestAnimationFrame` loop, paused when the section is outside the viewport via `IntersectionObserver`. The accent-swap stays owned by the app shell (overlay open/close writes `--accent` to `:root`); the section's CTA and hot-stage emphasis read `--accent` through `color-mix(in oklab, #FFA400 calc(var(--bleed) * N%), var(--accent))` so persimmon → amber is a continuous gradient rather than a toggle. Active stage numeral flips persimmon → amber only at `peak`. "Watch it live · flip →" pill CTA couples border, halo, icon rotation, and sub-pixel jitter to the bleed ramp; flips to solid amber fill at `peak`; `flip →` suffix text fades in between bleed 0.55 and 1.0. Schematic grid: mobile 2-column (numeral / body), desktop 3-column (numeral / body / readouts), readouts collapse-on-mobile with `is-hot` expansion via `max-height`. Footnote session-event log seeded with 3 "already happened" events, ticks every 1600–2500ms. See `docs/input_artifacts/design_handoff_pipeline/README.md` for the canonical math, tier thresholds, motion timings, design tokens, accessibility rules, and the `PipelineSection` / `PipelineEditorial` / `data.js` reference implementation.

6. **Homepage Demos section rebuild** — Replace the three-card horizontal-scroll `DemosSection` with a single full-width section dedicated to the ecommerce demo, sitting between Pipeline and Services teaser. Section composition: eyebrow kicker (`Demo · Ecommerce · Tiers 2 + 3` or similar editorial eyebrow), oversized serif headline framing the demo's narrative, supporting copy explaining how the instrumentation reveals itself as visitors interact and why the confirmation page is the Tier 3 payoff, primary CTA (`Enter the demo →` linking to `/demo/ecommerce`), optional small visual preview (product tile, terminal-styled event readout, or confirmation-page thumbnail — enough to hint at the aesthetic shift without becoming a gallery), and an optional "subscription and lead gen demos · in development" honesty note (drop if it dilutes focus). Remove the mobile swipe-hint bars. See `docs/UX_PIVOT_SPEC.md` §3.7.

7. **Remove subscription and lead gen demos from the site** — Delete `/demo/subscription` and `/demo/leadgen` routes entirely (pages, layouts, analytics dashboards, signup flows, account dashboards, thank-you pages). Delete the subscription and lead gen data libraries (`src/lib/demo/plans.ts`, the subscription and leadgen sections of `src/lib/demo/dashboard-data.ts`), the subscription and leadgen dashboard components, and the partnership form. Remove subscription and lead gen links from the footer (demo links reduce to the ecommerce demo only). Simplify `DemoFooterNav` to a single back-to-homepage affordance or remove the component — pick whichever is cleaner once the cross-demo links are gone. Keep the subscription and lead gen event types in `src/lib/events/schema.ts` — they remain in the Session State coverage denominator and their unfired presence communicates "more of the site exists" until the demos return. See `docs/UX_PIVOT_SPEC.md` §3.7 and §4. **Redirect plan for deleted routes:** wire permanent (301) redirects in `next.config.js` via the `redirects()` async function; each entry must set `permanent: true` (Next.js defaults to 302 without the flag — easy miss). `/demo/subscription/:path*` → `/?rebuild=subscription#demos`, `/demo/leadgen/:path*` → `/?rebuild=leadgen#demos`. The `:path*` pattern catches deep links into child routes (`/demo/subscription/account`, `/demo/leadgen/thanks`, etc.) so no child path 404s. The Demos section reads the `rebuild` query param on mount and surfaces a one-line honesty banner (e.g. "The subscription demo is being rebuilt — it'll return after the ecommerce rebuild ships.") that dismisses on first interaction. External links from LinkedIn, old session handoffs, and search indexes continue to resolve into the new Demos section rather than 404.

8. **Contact form session-state ride-along (optional; deferred by default in 9E)** — Per `docs/UX_PIVOT_SPEC.md` §3.6 this capability is marked optional and may be deferred or cut entirely without affecting the pivot's core shape. Default treatment in 9E: defer to a later pass (post-9F) so the pivot doesn't absorb additional surface area (new form field, consent interaction logic, a payload shape whatever endpoint receives the form must accept). If shipped: a visible checkbox on `/contact` labeled "Share my session state with this message" (default checked if marketing consent is granted, unchecked if denied); a human-readable summary below the checkbox showing exactly what will be sent; a hidden `session_state` field serialized only when the box is checked; consent-denied copy surfaces the override explicitly. No silent transmission under any condition. Full payload shape in §3.6.

9. **Nav & Session State analytics (accelerated from Phase 10)** — The nav pivot removes the conventional header nav in favor of the `SessionPulse` + footer-nav + Session State portal combination. `docs/UX_PIVOT_SPEC.md` §3.1 explicitly flags desktop nav discoverability as "the trickier surface," and the pivot's gamification loop (coverage bar, demo funnel, portal CTA) depends on visitors actually reaching Session State. Phase 10's site-level analytics chunk is too late to validate the bet — the behavioral signal between ship and Phase 10 would be months of confounded data — so this deliverable accelerates nav-specific tracking into 9E. The existing `SessionPulse` click already fires `click_cta`; this deliverable extends coverage with six new event types plus a `cta_location` audit:

   - **`nav_hint_shown`** — fires once when the first-session pulse-ring hint renders; no params beyond `BaseEvent`. Emits only in the session the hint displays.
   - **`nav_hint_dismissed`** — fires when the hint clears; `dismissal_mode: 'scroll' | 'click_session_pulse' | 'click_outside' | 'timeout'`. Semantics (aligned with deliverable 1): `scroll` = any `scroll` event on `document`; `click_session_pulse` = a `click` whose target is the `SessionPulse` element or any of its descendants; `click_outside` = any `click` whose target is not `SessionPulse` or a descendant (covers the full "any other click on the page" case); `timeout` = the ~10s auto-clear timer elapsed without user interaction. The four values are disjoint and exhaustive against the listener surface — a clicked page element is always either `SessionPulse` (→ `click_session_pulse`) or not (→ `click_outside`).
   - **`session_pulse_hover`** — desktop-only, debounced to at most once per 60 seconds per session. Signals that a visitor noticed the affordance without clicking. Suppressed under coarse-pointer media query to avoid double-firing on touch devices that synthesize hover.
   - **`overview_tab_view`** — fires when the overlay opens and the Overview tab is the active landing surface; `source: 'default_landing' | 'manual_select'`. `default_landing` is the fresh-open case; `manual_select` fires when a visitor clicks back to Overview from Timeline or Consent. (Post-UAT F1 rename — pre-rename name was `session_state_tab_view`.) Peers `timeline_tab_view` and `consent_tab_view` added in F2 with identical `source` semantics — each tab gets its own coverage chip so the Session coverage meter rewards depth-of-exploration per tab.
   - **`portal_click`** — fires when any portal link inside the Overview tab is clicked; `destination: 'services' | 'about' | 'contact'`. Distinct from `click_cta` so the portal's conversion rate is isolable from other CTA types.
   - **`coverage_milestone`** — fires once per session when event-type coverage crosses a threshold; `threshold: 25 | 50 | 75 | 100`. The denominator is the renderable subset used to render the Overview coverage bar (see deliverable 4 + `RENDERABLE_EVENT_NAMES` added in UAT F2).
   - **`click_cta` audit** — the existing `SessionPulse` click fires `click_cta`; verify `cta_location: 'session_pulse'` is set consistently. Spot-audit `click_cta` emissions across `OverviewTab` portal links, the threshold-gated contextual contact CTA in the Overview tab (deliverable 3), the pipeline-section "See your session" CTA, the footer's "Session" column (which is nav-adjacent post-9E since the footer is the conventional-nav fallback), and any other nav-adjacent affordances so `cta_location` values form a **closed** enum. The closed enum for 9E nav-adjacent CTAs: `session_pulse`, `portal_services`, `portal_about`, `portal_contact`, `contact_cta_threshold`, `pipeline_see_your_session`, `footer_session`. Any nav-adjacent CTA added during implementation that doesn't fit one of the seven values extends the enum explicitly in the schema rather than slipping in as a free-form string — the "etc." escape hatch is closed. Enforcement: `ClickCtaEvent.cta_location` is typed as the closed `CtaLocation` union in `src/lib/events/schema.ts` (not `string`), so adding an unlisted value fails type-check at the call site. (Post-UAT F1: `pipeline_watch_it_live` → `pipeline_see_your_session`; `footer_under_the_hood` → `footer_session`.)

   Add the six new interfaces to `src/lib/events/schema.ts` and extend the `DataLayerEvent` union accordingly. The `event_type_coverage.total` denominator derived from the schema (see deliverable 4) grows from 16 to 22, which surfaces the new events in the Session State coverage bar — visitors see the nav-gamification events as fired / unfired chips alongside the existing set, which is a positive side effect: it makes the gamification surface more substantive. *Visitor-facing tradeoff:* the average first-session coverage fraction will start visually lower against a denominator of 22 than against 16 (same numerator, larger denominator = a ~9-percentage-point shift at the entry state). This is the intended tradeoff: a substantive gamification surface beats a higher starting fraction against a thinner denominator. Future sessions should not "fix" the lower starting bar by shrinking the denominator. All six events flow through the standard data-layer / GTM / sGTM / BigQuery pipeline with no new infrastructure — they piggyback on today's routing. No new destinations, no consent implications beyond the existing `analytics_storage` gate (all six are analytics-only, none carry PII).

**Cancellations (cross-reference; tracked in `docs/PHASE_STATUS.md`):**

- **Phase 9C — Lead Gen Demo: Tier 1 Privacy/Consent + Tier 3 BI + AI Narrative Reporting** — cancelled. The lead gen demo is removed from the site in deliverable 7 above and will be reintroduced in a later, separately-numbered phase after Phase 9F ships, rebuilt to the native-reveal pattern language `docs/UX_PIVOT_SPEC.md` §3.5 establishes. The consent-enforcement and AI-narrative storylines are preserved as future work; only the current implementation is cancelled.
- **Phase 9D — Subscription Demo: Tier 4 (Attribution & Advanced Analytics)** — cancelled. The subscription demo is removed from the site in deliverable 7 above and will be reintroduced in a later, separately-numbered phase, rebuilt to the same pattern language. The Shapley attribution and cohort-retention storylines are preserved as future work.

Neither demo returns as a "before" state of its current implementation. Both start from the pattern language once it's established in 9F.

**Constraints:**

- All existing data layer events continue to fire correctly across the restructure. The event schema (`src/lib/events/schema.ts`) is extended only by deliverable 9's six nav-analytics events (the `DataLayerEvent` union grows from 16 to 22 entries); all pre-existing event interfaces persist unchanged. The UI that fires subscription / leadgen events is removed but the type definitions persist so they continue to serve as part of the Session State coverage denominator.
- `prefers-reduced-motion` disables the pipeline bleed ramp's animations (scanline drift, phosphor breathe, RGB sweep, flicker bursts, stage rotation, peak jitter, CTA halo/jitter), the Session State typing animation, and the first-session hint pulse ring. Bleed layers still render statically; tier thresholds still cross on scroll; only the time-based motion is suppressed.
- The `SessionPulse` is the only nav affordance in the header. No persistent hamburger / backup menu icon — the footer plus Session State tab are the escape hatches.
- Editorial persimmon (`#EA5F2A`) stays the paper accent; phosphor amber (`#FFA400`) stays the underside accent. Amber on the homepage is restricted to bleed-through and to the `SessionPulse` surface itself. No editorial surface adopts amber as its primary accent.
- Session State persists via `sessionStorage` only — no cross-session persistence in this phase.
- Contact form never transmits session state without an explicit, visible, checked checkbox (applies only if deliverable 8 ships).
- The overlay is reachable from the `SessionPulse` on every page, including `/demo/ecommerce/*`. Demo pages keep today's overlay-based reveals until Phase 9F rebuilds them — no demo-page changes in 9E.
- The `useEventStream` / `useLiveEvents` hooks, SSE Cloud Run service, session-ID cookie (`_iap_sid`), GTM / sGTM, Pub/Sub, BigQuery, Dataform, Metabase, and the Phase 9B signed-embed signer all stay unchanged in 9E.

**Why this is Phase 9E (not 9A-v3 or a reopen of 9B):** The 9A-redesign surfaces shipped and 9B's ecommerce Tier 2/3 story shipped — both delivered what they promised. This pivot reshapes the navigation model and the overlay's role across the whole site and removes two demo surfaces entirely; rewriting those deliverables in place would muddy what shipped vs. what the pivot replaces. Numbering as 9E mirrors the 9A → 9A-redesign precedent: a dedicated phase that supersedes parts of earlier phases while leaving their history intact. Phase 9F then rebuilds the ecommerce demo's reveal mechanics on top of 9E's foundation.

---

## Phase 9C — Lead Gen Demo: Tier 1 Privacy/Consent + Tier 3 BI + AI Narrative Reporting

> 🚫 **CANCELLED** as part of the Phase 9E UX pivot. The consent-enforcement narrative in this phase is arguably the strongest Tier 1 proof-of-capability on the whole site — live routing differences as the visitor grants / denies marketing consent. The AI narrative reporting storyline is a meaningful Tier 3+ capability demonstration. Both have real value and are **deliberately not being rebuilt now** to avoid the scope-creep pattern that absorbed the last two redesign passes. The lead gen demo is removed from the site in Phase 9E deliverable 7 (with redirects, per that deliverable). Reintroduction happens as a separate, dedicated later phase after 9F ships — not by speeding up 9F or folding scope back into 9E. The original deliverables below are preserved as seed material for that reintroduction phase; they will not be implemented as specified. Rationale: `docs/UX_PIVOT_SPEC.md` §4 and the "Strategic framing" paragraph in the Phase 9E block above.

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

> 🚫 **CANCELLED** as part of the Phase 9E UX pivot. The Shapley attribution narrative in this phase is the Tier 4 payoff — the most analytically sophisticated proof-of-capability the site demonstrates. Cohort retention and LTV analysis carry real consulting value. Together with Phase 9C, this cancellation shrinks the site's demonstrated tier coverage from 1+2+3+4 to 2+3 until the reintroduction phases ship. This is the honest cost of the pivot and is **deliberately being absorbed** to avoid the scope-creep pattern that absorbed the last two redesign passes. The subscription demo is removed from the site in Phase 9E deliverable 7 (with redirects, per that deliverable). Reintroduction happens as a separate, dedicated later phase after 9F ships — not by speeding up 9F or folding scope back into 9E. The original deliverables below are preserved as seed material for that reintroduction phase; they will not be implemented as specified. Rationale: `docs/UX_PIVOT_SPEC.md` §4 and the "Strategic framing" paragraph in the Phase 9E block above.

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
4. Analytics on the site itself: track which demo visitors engage with, how far into the ecommerce funnel they reach, overall time-on-site / scroll-depth distribution, and conversion-to-contact-form signal. This data informs sales conversations. *Note:* the nav-specific and Session State portion of site-self-analytics was accelerated into Phase 9E deliverable 9 (`nav_hint_shown` / `nav_hint_dismissed`, `session_pulse_hover`, `session_state_tab_view`, `portal_click`, `coverage_milestone`, and the `click_cta` / `cta_location` audit) — the rationale is in the 9E block. Phase 10's analytics work is the remaining scope: demo interaction patterns, broader time / scroll / session signal, and any cross-event funnel reporting that wasn't needed to validate the nav bet at ship
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
- Phase 9A (core architecture) is the critical path for 9B. The full-page flip mechanic, ambient bubbles, and DemoNav removal must be stable before building demo-specific underside content
- Phase 9B should be built first among the demo phases — it exercises every under-the-hood feature in sequence and establishes patterns for later demo phases
- **Phase 9E (UX pivot) supersedes the original 9C and 9D scopes.** 9C and 9D are cancelled; the subscription and lead gen demos are removed from the site in 9E and will be reintroduced in later, separately-numbered phases after Phase 9F rebuilds the ecommerce demo's reveal mechanics to the pattern language in `docs/UX_PIVOT_SPEC.md` §3.5. The reintroduction phases will reuse the Shapley attribution, cohort retention, LTV analysis, and consent-enforcement storylines preserved in the cancelled 9C/9D blocks as seed material — rebuilt from the pattern language, not ported from the current implementations
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
