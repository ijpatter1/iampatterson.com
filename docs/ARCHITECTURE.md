# iampatterson.com — Technical Architecture

## System Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  Cookiebot   │────▶│  Client GTM  │────▶│    sGTM       │
│  (Next.js)   │     │    (CMP)     │     │ (data layer) │     │  (Stape)     │
└──────┬───────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
       │                                                              │
       │ WebSocket/SSE                                    ┌───────────┼───────────┐
       │                                                  │           │           │
       ▼                                                  ▼           ▼           ▼
┌──────────────┐     ┌──────────────┐              ┌──────────┐ ┌─────────┐ ┌─────────┐
│  Cloud Run   │◀────│   Pub/Sub    │              │   GA4    │ │ BigQuery│ │Meta/Gads│
│  (WebSocket) │     │   (topic)    │              │          │ │  (raw)  │ │(simulated)│
└──────────────┘     └──────────────┘              └──────────┘ └────┬────┘ └─────────┘
                                                                     │
                                                              ┌──────┴──────┐
                                                              │  Dataform   │
                                                              │ (transform) │
                                                              └──────┬──────┘
                                                                     │
                                                              ┌──────┴──────┐
                                                              │   Marts     │
                                                              │ (BigQuery)  │
                                                              └──────┬──────┘
                                                                     │
                                                              ┌──────┴──────┐
                                                              │ Dashboards  │
                                                              │(Looker/MB)  │
                                                              └─────────────┘
```

---

## Phase 1 — Foundation Architecture

### Next.js Application

**Framework:** Next.js 14+ with App Router
**Language:** TypeScript (strict mode: `"strict": true` in tsconfig.json)
**Styling:** Tailwind CSS with a custom design system

**App Router Structure:**

```
src/app/
├── layout.tsx              # Root layout — GTM script, Cookiebot script, global styles
├── page.tsx                # Homepage
├── services/
│   └── page.tsx            # Services overview (four consulting tiers)
├── about/
│   └── page.tsx            # Background, experience, approach
├── contact/
│   ├── page.tsx            # Contact form
│   └── thanks/
│       └── page.tsx        # Post-submission confirmation (conversion URL)
├── demo/                   # (Phase 6 — empty until then)
│   ├── ecommerce/
│   ├── subscription/
│   └── leadgen/
└── api/                    # (Phase 2+ — API routes for event pipeline)
```

**Key architectural decisions:**

- Server Components by default. Only add `'use client'` when the component needs browser APIs, state, or event handlers
- The data layer push helper (`src/lib/events/push.ts`) is a client-side utility — components that fire events must be Client Components
- Layout.tsx loads GTM and Cookiebot scripts via `<Script>` component with appropriate loading strategies (`afterInteractive` for GTM, `beforeInteractive` for Cookiebot if consent is needed before GTM fires)
- **Progressive nav activation:** The global nav includes Home, Services, About, Contact, and a Demos dropdown. In Phase 1, the Demos dropdown is hidden or disabled (no demo routes exist yet). It activates when Phase 6 ships the demo front-ends. The flip-the-card toggle is also hidden until Phase 3. See `docs/CONTENT_GUIDE.md` for the full nav structure
- **Content source:** All page copy, headings, CTAs, form fields, and product listings come from `docs/CONTENT_GUIDE.md`. Do not invent placeholder content — the content guide is the source of truth

### Data Layer Specification

All browser-side event tracking flows through a typed data layer. This is the contract between the frontend and GTM.

**Location:** `src/lib/events/schema.ts`

**Base event shape:**

```typescript
interface BaseEvent {
  event: string;           // snake_case event name
  timestamp: string;       // ISO 8601
  session_id: string;      // from first-party cookie (Phase 2 adds sGTM-set cookie)
  page_path: string;       // window.location.pathname
  page_title: string;      // document.title
}
```

**Phase 1 events:**

| Event Name | Trigger | Additional Parameters |
|---|---|---|
| `page_view` | Route change (App Router navigation) | `page_referrer` |
| `scroll_depth` | 25%, 50%, 75%, 100% scroll thresholds | `depth_percentage`, `depth_pixels` |
| `click_nav` | Navigation link click | `link_text`, `link_url` |
| `click_cta` | CTA button click | `cta_text`, `cta_location` |
| `form_field_focus` | User focuses a form field | `form_name`, `field_name` |
| `form_start` | First interaction with any form (fires once per form per session) | `form_name` |
| `form_submit` | Form submission | `form_name`, `form_success` |
| `consent_update` | Cookiebot consent change | `consent_analytics`, `consent_marketing`, `consent_preferences` |

**Note:** Demo pages (Phase 6) add business-model-specific events (e.g., `product_view`, `add_to_cart`, `purchase`, `trial_signup`, `form_complete`). See `docs/CONTENT_GUIDE.md` for the full event specifications per demo.

**Push helper:**

```typescript
// src/lib/events/push.ts
export function pushEvent(event: BaseEvent & Record<string, unknown>): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}
```

### Cookiebot + GTM Consent Mode

**Cookiebot** is the Consent Management Platform (CMP). It handles:
- Displaying the consent banner to visitors
- Collecting and storing consent preferences
- Communicating consent state to GTM via Google Consent Mode v2

**Integration sequence:**

1. Cookiebot script loads in `layout.tsx` (before GTM)
2. Cookiebot fires `consent_default` on page load with region-appropriate defaults
3. GTM loads and reads consent state
4. When a visitor updates preferences, Cookiebot fires `consent_update` which GTM picks up
5. Tags in GTM that require consent (analytics, marketing) only fire when the relevant consent category is granted

**GTM Consent Mode v2 mapping:**

| Cookiebot Category | Consent Mode Signal | Controls |
|---|---|---|
| Necessary | (always granted) | sGTM base event routing |
| Statistics | `analytics_storage` | GA4, BigQuery event sink |
| Marketing | `ad_storage`, `ad_user_data`, `ad_personalization` | Meta CAPI, Google Ads (simulated) |
| Preferences | `functionality_storage` | Personalization features |

### GTM Configuration

**Relationship with Stape auto-generated templates:**

Stape auto-generates a starter GTM web + sGTM container pair when you set up a new site. These are reference templates for a lead gen site, **not our production containers**. Our site uses its own containers (`GTM-MWHFMTZN` web, sGTM on `io.iampatterson.com`) with our own event taxonomy. We keep Stape's infrastructure (hosting, GA4 client, Data Client, BigQuery tag template) and build our own tag/trigger/variable configuration on top.

**What Stape provides (infrastructure):**

- sGTM container hosting on `io.iampatterson.com` (custom domain, same-origin)
- GA4 client — standard sGTM client that parses incoming GA4 hits
- Stape Data Client — proprietary client for routing events to external destinations
- "Write to BigQuery" community tag template

**What we configure ourselves:**

- Web GTM container (`GTM-MWHFMTZN`) — our tags, triggers, and variables
- sGTM tags/triggers for our event taxonomy
- BigQuery write tag configuration
- Phase 2: Pub/Sub custom tag for real-time pipeline
- Phase 6: demo-specific event tags and triggers

**Client-side GTM container (`GTM-MWHFMTZN`):**

- Loads via `<Script>` in root layout with sGTM same-origin transport (`io.iampatterson.com`)
- Contains a minimal set of tags — most processing happens in sGTM
- GA4 config tag with `send_page_view: false` (page views pushed explicitly from app code)
- GA4 event tags for each Phase 1 event, fired by data layer triggers
- All event parameters are pushed to the data layer by application code, not extracted by GTM
- Consent Mode v2 integration — tags respect consent state from Cookiebot
- Configuration spec: `infrastructure/gtm/web-container.json` (Phase 1)

**Server-side GTM (sGTM) on Stape:**

- Custom domain `io.iampatterson.com` for same-origin cookie context
- Stape handles the sGTM container hosting
- GA4 client receives all hits from the web container
- sGTM routes events to:
  - GA4 (Measurement Protocol) — via sGTM GA4 tag
  - BigQuery (Stape "Write to BigQuery" tag, "All Event Data" mode)
  - Pub/Sub (custom tag — Phase 2)
  - Meta CAPI (simulated — Phase 6)
  - Google Ads Enhanced Conversions (simulated — Phase 6)
- Configuration spec: `infrastructure/gtm/server-container.json` (Phase 1)

### BigQuery Event Sink

**Dataset:** `iampatterson_raw`
**Table:** `events_raw`
**Tag:** Stape "Write to BigQuery" community template
**Setup:** `infrastructure/bigquery/setup.sh` (idempotent)

The sGTM BigQuery tag uses "All Event Data" mode — `getAllEventData()` writes the full sGTM event object. Column names align with sGTM's Common Event Data model (`page_location`, `ip_override`, etc.) and our custom event parameters (`session_id`, `cta_text`, etc.). Fields not matching a BQ column are silently dropped (`ignoreUnknownValues: true`).

**Schema design decisions:**
- `received_timestamp` is INT64 (epoch ms from the tag's `getTimestampMillis()`) — convert to TIMESTAMP in Dataform staging
- `timestamp` is the client-side ISO string passed as an event parameter from the data layer
- Only `event_name` and `received_timestamp` are REQUIRED — all event parameters are NULLABLE to avoid insert failures
- Ingestion-time partitioned (daily), clustered by `event_name` and `session_id`
- Geo fields (`geo_country`, etc.) are not in the raw table — derive from `ip_override` in Dataform staging
- `page_location` (full URL) and `page_path` (pathname) are both stored as sGTM provides both

This raw table is the starting point for the Dataform transformation pipeline in Phase 5.

### Deployment

**Next.js app:** Vercel

Vercel is the deliberate choice for the frontend, not just a convenience. Most clients will host their websites on platforms like Vercel, Netlify, Shopify, or WordPress — not on GCP. By hosting the consulting site on Vercel while running the measurement infrastructure on GCP, the site demonstrates that the stack works seamlessly across the provider boundary that real clients will have. The cross-origin event pipeline (browser on Vercel → sGTM on Stape → Pub/Sub on GCP → WebSocket on Cloud Run → back to the browser) is the same architecture clients experience. If a prospect asks "does this work with our site on Vercel?" the answer is "you're looking at it."

**sGTM:** Stape managed hosting with custom domain

**Backend services (all on GCP):**
- Cloud Run — WebSocket/SSE service (Phase 2), background data generator (Phase 4)
- BigQuery — raw event storage, Dataform transformations, AI functions
- Pub/Sub — real-time event routing from sGTM to WebSocket service
- Dataform — transformation pipeline (raw → staging → marts)
- Cloud Storage — AI access layer exports

---

## Phase 2 — Real-Time Event Pipeline Architecture

### Session ID

sGTM sets a first-party cookie (`_iap_sid`) with a UUID v4 session ID. This cookie is included as a parameter on every event flowing through the pipeline. The session ID scopes the WebSocket/SSE connection so each visitor only sees their own events.

### Pub/Sub

A custom sGTM tag publishes every event to a Pub/Sub topic (`iampatterson-events`). The message payload is the full event JSON including session ID, event name, timestamp, and all parameters.

### Cloud Run WebSocket/SSE Service

A lightweight Node.js service on Cloud Run that:
1. Subscribes to the Pub/Sub topic
2. Maintains a map of active WebSocket/SSE connections keyed by session ID
3. When a message arrives, routes it to the matching session's connection
4. Handles connection lifecycle (open, close, reconnect)

### Client-Side Hook

A React hook (`useEventStream`) that:
1. Reads the session ID from the cookie
2. Establishes a WebSocket or SSE connection to the Cloud Run service
3. Maintains an in-memory event buffer (most recent N events)
4. Exposes the buffer and connection status to consuming components

---

## Phase 3 — Flip-the-Card UI Architecture

*To be expanded when Phase 3 begins. Key decisions:*

- Mobile: bottom sheet pattern (partial → full pull-up)
- Desktop: translucent overlay with sidebar event stream
- Event timeline renders from the `useEventStream` hook's buffer
- Overlay is route-aware via Next.js App Router

---

## Phases 4-9 — Architecture Stubs

*These sections will be expanded as each phase approaches. See `docs/REQUIREMENTS.md` for deliverable-level detail.*

### Phase 4 — Background Data Generator
Cloud Run Python/Node.js service. Sends synthetic events to sGTM via HTTP. Three business model profiles. Configurable parameters.

### Phase 5 — Data Infrastructure
BigQuery medallion architecture via Dataform. AI.CLASSIFY/AI.IF for campaign taxonomy. RAG pipeline with ML.GENERATE_TEXT_EMBEDDING.

### Phase 6 — Demo Front-Ends
Three route namespaces within the Next.js app. Each with its own data layer specification matching the generator output.

### Phase 7 — BI Layer
Looker Studio and/or Metabase on Dataform mart tables. Embedded or deep-linked from the flip-the-card overlay.

### Phase 9B-infra — Metabase Deployment

Self-hosted Metabase on GCP, gated by IAP, connecting to the Phase 5 mart tables. Full task spec at `docs/input_artifacts/metabase-deployment-plan.md`; scripts and runbook land at `infrastructure/metabase/`.

**Traffic path:**

```
Browser → bi.iampatterson.com
       → Google Load Balancer + IAP (Google SSO gate, allowlist)
       → Cloud Run (metabase/metabase container, ingress=internal-and-cloud-load-balancing)
       → Cloud SQL Postgres (metabase-app-db, via Cloud SQL Auth Proxy, private IP)
       → BigQuery iampatterson_marts (dataset-scoped read-only SA key)
```

**Three-layer security model:**

1. **IAP (Google SSO)** — only allowlisted Google accounts reach the Metabase login page. Blocks "exposed Metabase on the internet" attack classes (auth bypass CVEs, credential stuffing, enumeration).
2. **Metabase auth** — admin password + 2FA. Second layer if IAP is misconfigured.
3. **BigQuery IAM** — `metabase-bigquery` service account is dataset-scoped read-only. Even full Metabase compromise cannot write to BigQuery or reach other datasets.

The only long-lived credential material is the `metabase-bigquery` JSON key. Rotated annually per the runbook.

**GCP resources provisioned:**

- Cloud SQL: instance `metabase-app-db` (Postgres 15, db-f1-micro, us-central1), database `metabase`, user `metabase`, daily backups + PITR
- Cloud Run: service `metabase` (gen2, 2Gi/1 CPU, min-instances=1, ingress locked to LB)
- Load balancer: serverless NEG, backend service, URL map, target HTTPS proxy, global forwarding rule with reserved static IP, Google-managed SSL cert for `bi.iampatterson.com`
- Service accounts: `metabase-runtime@` (Cloud Run identity — Cloud SQL client + scoped secret access) and `metabase-bigquery@` (Metabase→BQ identity — `bigquery.dataViewer` on `iampatterson_marts` only, project-level `bigquery.jobUser`)
- Secret Manager: `metabase-db-password`, `metabase-encryption-key` (never rotate — decrypts credentials in app DB), `metabase-bq-sa-key`, `metabase-iap-client-id`, `metabase-iap-client-secret`
- IAP: OAuth 2.0 client + `roles/iap.httpsResourceAccessor` allowlist on the backend service

**Pinned versions (no `:latest`):** Metabase image tag recorded at deploy time, Cloud SQL Postgres 15, Cloud Run gen2.

**Expected baseline cost:** $60–75/month (Cloud Run warm + Cloud SQL + LB + static IP), plus BigQuery query costs proportional to dashboard usage. Budget alert at $100/month.

**Application-layer consumer:** Phase 9B deliverables 6a (dashboards as code) and 6b (confirmation-page signed embed) build on this deployment. The deployment does not, on its own, change the Next.js application surface.

### Phase 9B — Dashboards as Code (deliverable 6a)

Metabase dashboards and questions for the e-commerce demo are authored as versioned YAML specs in `infrastructure/metabase/dashboards/` and applied via the Metabase REST API. Same philosophy as Dataform for transformations: BI assets live in git, reviewable as diffs, reproducible via a single `apply.sh` invocation.

**Directory layout:**

```
infrastructure/metabase/dashboards/
├── apply.sh                             # idempotent upsert driver
├── README.md                            # auth + runbook
├── lib/
│   └── metabase_client.sh               # curl wrappers around /api/card, /api/dashboard
├── specs/
│   ├── questions/
│   │   ├── 01_funnel_conversion_by_channel.yaml
│   │   ├── 02_aov_trend_90d.yaml
│   │   ├── 03_roas_by_campaign.yaml
│   │   ├── 04_revenue_share_by_channel.yaml
│   │   ├── 05_customer_ltv_distribution.yaml
│   │   └── 06_daily_revenue_trend.yaml
│   └── dashboards/
│       └── ecommerce_executive.yaml
└── .ids.json                            # gitignored; records resolved IDs
```

**Auth model:** `apply.sh` authenticates to `https://bi.iampatterson.com/api/*` with a Metabase admin API key stored in Secret Manager as `metabase-api-key`. The key is generated once via Metabase's Admin → Authentication → API Keys UI and scoped to the Admin group. Script fetches the key at run time via `gcloud secrets versions access`; never written to disk.

**IAP and the API path:** `/api/*` requests carrying the `x-api-key` header must bypass IAP. This is provisioned as a URL-map path-matcher addendum to Phase 9B-infra Task 5: IAP gates the UI path (`/*` → SSO) but not the API path (`/api/*` → Metabase direct). Without this split, `apply.sh` cannot reach the API from an unauthenticated shell. The split also serves deliverable 6b's `/embed/*` path (see "Open decisions" below).

**Security tradeoffs of the path split:** Pre-split, IAP's Google-SSO-backed challenge was the first gate on every request, including brute-force and enumeration attempts on `/api/session`, `/api/user`, and `/api/setup/*`. Post-split, those endpoints are directly reachable from the public internet — Metabase's own auth layer (session cookies, admin API key) is the only remaining protection on `/api/*`, and Metabase's signed-JWT validation is the only protection on `/embed/*`. Neither path has Cloud Armor, rate limiting, or a WAF in front of it. For a solo-user portfolio site this is acceptable risk: the attack surface is Metabase's well-maintained OSS auth code, plus a single admin credential rotated annually, plus the `metabase-encryption-key` that encrypts credentials in the app DB. For a multi-user production deployment, a Cloud Armor security policy with per-IP rate limits on `/api/session` and a WAF rule on `/api/setup/*` would be appropriate. Deferred to Phase 11 (Operational Readiness) if the threat model changes.

**Apply flow (idempotent):**

1. Fetch API key from Secret Manager.
2. Resolve the BigQuery database ID via `GET /api/database`, match by name `iampatterson marts`.
3. Ensure an "E-Commerce Dashboards" collection exists (`GET /api/collection`; `POST` if missing).
4. For each `specs/questions/*.yaml`: look up by name in the collection; `POST /api/card` if new, `PUT /api/card/{id}` if present.
5. For `specs/dashboards/ecommerce_executive.yaml`: upsert via `/api/dashboard`, then `PUT /api/dashboard/{id}` with the `dashcards` array mapping card IDs to grid positions.
6. Enable signed embedding on the dashboard and on the three cards (funnel, AOV, daily revenue) consumed by deliverable 6b.
7. Write resolved IDs to `.ids.json` (gitignored) and to Secret Manager as `metabase-embed-config` for 6b's Next.js signer.

**Question → mart-table map:**

| # | Question | Source mart | Viz |
|---|---|---|---|
| 1 | Funnel conversion by channel | `mart_session_events` | Grouped bar (4 stages per channel) |
| 2 | AOV trend (90d) | `mart_session_events` | Line |
| 3 | ROAS by campaign | `mart_campaign_performance` | Bar |
| 4 | Revenue share by channel (latest month) | `mart_channel_attribution` | Donut |
| 5 | Customer LTV distribution | `mart_customer_ltv` | Histogram |
| 6 | Daily revenue trend (30d) | `mart_session_events` | Line |

All six use native SQL (not MBQL), hand-written in the YAML specs so they're readable in diffs and portable if Metabase is ever replaced.

**Secrets used across 6a and 6b:**

- `metabase-api-key` — admin API key used by `apply.sh`. Generated in Metabase UI, stored in Secret Manager.
- `metabase-embedding-secret-key` — shared secret for signing embed JWTs. Generated by Metabase on static-embedding enable; stored in Secret Manager for durability; mirrored to Vercel env as `MB_EMBEDDING_SECRET_KEY` at runtime.
- `metabase-embed-config` — JSON `{dashboardId, cardIds: {funnel, aov, dailyRevenue}}` produced by `apply.sh --publish-embed-config`, mirrored to Vercel env as `METABASE_EMBED_CONFIG` for 6b's signer.

### Phase 9B — Confirmation-page signed embeds (deliverable 6b)

The IAP-bypass decision landed on the URL-map path split (deliverable 6a's `/api/*` addendum, extended to `/embed/*`): `metabase-backend-direct` wraps the same serverless NEG as the IAP-gated backend but has IAP never attached, so anonymous visitors load iframes directly. Static-image embeds and server-side proxy embeds were rejected — the first loses drill-down interactivity, the second adds latency and a new trust boundary for no architectural gain.

**Placement: inline, not in the overlay.** The confirmation page is the *Tier 3 payoff* surface in the ecommerce narrative — the visitor has completed a purchase and the inline embeds frame their specific order against the aggregate. The overlay stays the *Tier 2 plumbing* surface (in use at each funnel step). Dropping BI embeds into the overlay on the confirmation route would duplicate them with the inline copy and hide the most direct connection the demo makes between one visitor's action and a dashboard metric. The overlay on `/demo/ecommerce/confirmation` instead houses the three non-embeddable questions (ROAS, Revenue share, LTV) as summary cards with deep-links into the IAP-gated `/dashboard/2`.

**Signer pattern.** A Next.js Server Component at the confirmation page root reads `MB_EMBEDDING_SECRET_KEY` and `METABASE_EMBED_CONFIG` from env. It mints three HS256 JWTs using `jsonwebtoken`, one per embeddable card:

```
payload = { resource: { question: <cardId> }, params: {}, exp: now + 600 }
url     = `https://bi.iampatterson.com/embed/question/${jwt}#bordered=true&titled=true`
```

10-minute TTL is long enough for a tab-switch, short enough that a leaked URL has a small shelf life. Each signed URL is passed as a prop to a client component that renders the iframe with `loading="lazy"` and `border=0`. Signing at render time avoids a client-side fetch round-trip and a flash of mocks → embeds — the JWT is in the iframe `src` on first paint. An API-route signer would only be needed if we add per-interaction filters (date range, channel filter); static 10-minute signatures suffice for 6b.

**Narrative ordering** of the three inline embeds (see `docs/REQUIREMENTS.md` Phase 9B deliverable 6b for captions):

1. Daily revenue trend (30 days) — most immediate tie to the visitor's order.
2. Funnel conversion by channel — contextualizes the purchase in the denominator.
3. AOV trend (90 days) — zooms out to trend.

### Phase 9A-redesign — Editorial Design System

Reskin of the Phase 9A surfaces (homepage, `/services`, Session overlay — post-UAT F1 rename; originally "under-the-hood overlay") per `docs/input_artifacts/iampatterson-com/`. Demo routes and all data-pipeline code are untouched.

**Design tokens.** Instrument Serif joins the existing Plus Jakarta Sans + JetBrains Mono stack as the display face. Accent is a single CSS custom property `--accent` that takes one of two values: persimmon `#EA5F2A` on the marketing/paper surface, phosphor amber `#FFA400` in the Session overlay. Neutral palette (paper/ink scale) aligns with the clean-slate scale finalized at the end of Phase 9A; no new greyscale tokens are introduced.

**Accent-swap mechanism.** `OverlayProvider` exposes an `overlayOpen` boolean. An effect in the provider (or a dedicated `useAccent` hook) sets `document.documentElement.style.setProperty('--accent', value)` — delayed by ~130ms on open so the flip lands mid-boot (the overlay's own boot phase holds the screen black for ~260ms), and instant on close. Under `prefers-reduced-motion`, the flip is instant on both edges and boot is skipped. The accent is read by any component that wants it via `var(--accent)` in CSS — no React prop threading.

**Overlay architecture.** The overlay is a full-page, position-fixed inset-0 host, not a sidebar or bottom sheet. It has three visual layers composed as siblings inside the host:

1. **Backdrop** — captures outside-click close, no visual treatment.
2. **CRT field** — three non-interactive `aria-hidden` divs stacked: flicker (low-opacity animated luminance wash), bloom (radial glow emanating from center), scanlines (horizontal gradient overlay at ~1.5px period). All three are gated by the `phase-on` state so they don't render during the boot hold.
3. **Overlay panel** — the actual scrollable content surface with the header, tab strip, and tab body.

The boot sequence is two-step: on open, phase goes `idle → boot` (black screen, accent swap initiates); after ~260ms, phase goes `boot → on` and panel content reveals with a one-shot tab-flash animation. On close, phase returns to `idle` and the accent flips back. Under `prefers-reduced-motion`, the `boot` phase is skipped — the panel renders immediately.

**Event-stream integration.** The homepage pipeline-section log feed and the overlay Timeline tab both consume the existing `useEventStream` hook directly. No new pipeline code is introduced. The pipeline log shows the most recent ~5 events; the Timeline tab shows the full session buffer (up to the hook's 100-event cap). Session ID is read from the same `_iap_sid` cookie established in Phase 2.

**Route integration.** The existing Next.js App Router routes (`/`, `/services`, `/about`, `/contact`, `/demo/*`) are preserved. The redesigned chrome (header, live strip, footer) wraps all consulting pages. Demo pages retain their existing Phase 9A `DemoFooterNav` and are not rewrapped. `OverlayProvider` stays route-aware: the overlay is reachable from consulting surfaces; the route guard continues to hide it on `/demo/*` paths so the demo instrumentation story stays contained to the demo's own under-the-hood pattern.

**What's deliberately unchanged.** Ambient event bubbles (Phase 9A Layer 1) stay as-is on consulting surfaces. The session ID cookie mechanism, the `useEventStream` hook, the SSE Cloud Run service, the data-layer event schema, GTM configuration, sGTM, BigQuery tables, Dataform, and all demo front-ends are unchanged.

**Phase 9B status.** 9B is dev-complete. The 9B-infra Metabase deployment (live at `https://bi.iampatterson.com/`) continues to serve the confirmation-page signed embeds. Phase 9E supersedes parts of 9B's overlay-tab routing: the Dashboards-tab content (ROAS, Revenue share, LTV summary cards) moves inline on the confirmation page as part of Phase 9F, which ships jointly with 9E.

### Phase 9E — Navigation & Overlay Pivot

Reshapes the nav model and the overlay's role across the whole site, introduces a new `SessionState` data model, rebuilds the homepage pipeline section as a progressive bleed-through reveal, and removes the subscription and lead gen demos from the site. The ecommerce demo's Tier 2/3 reveal mechanics are rebuilt to native patterns in Phase 9F. Full design rationale in `docs/UX_PIVOT_SPEC.md`; pipeline-section reference implementation in `docs/input_artifacts/design_handoff_pipeline/`.

**Release coupling.** 9E and 9F ship jointly — one production release cut when both are dev-complete and dual-evaluator-passing. Authored as separate phase blocks for tracking clarity, released together to avoid an interim-state in which the new nav / overlay / pipeline reveal lands on top of today's overlay-based ecommerce reveals. This coupling also resolves the 9E removal of the overlay's `Dashboards` tab: the three non-embeddable Metabase questions that live there today (ROAS, Revenue share, LTV) move inline on `/demo/ecommerce/confirmation` as part of 9F — never stranded between releases.

**Route deletions + permanent redirects (308).** `/demo/subscription/*` and `/demo/leadgen/*` route trees are deleted entirely in 9E deliverable 7. External inbound links (LinkedIn posts, search indexes, old session handoffs) are caught by permanent redirects wired in `next.config.mjs` via the `redirects()` async function with `permanent: true` (Next.js emits 308 for this, not 301 — originally documented as 301 and corrected in UAT F7): `/demo/subscription/:path*` → `/?rebuild=subscription#demos`, `/demo/leadgen/:path*` → `/?rebuild=leadgen#demos`. The `:path*` wildcard catches deep links into child routes so no descendant path 404s. The Demos section on the homepage reads the `rebuild` query param on mount and surfaces a dismissible one-line honesty banner ("{label} demo · returning soon" — UAT F8 phrasing). No Vercel-side configuration is required; redirects live in the Next.js config and deploy with the application.

**Navigation model.** The header loses its conventional nav (Home / Services / About / Contact / Demos dropdown) and the `MobileSheet` menu. What remains: `SessionPulse` (primary nav affordance; opens the overlay) + brand wordmark. `LiveStrip` is unchanged. Discoverability compensations: (1) `SessionPulse` occupies a prominent position — left-of-center on desktop, top-right on mobile — with a minimum 44×44px target and a hover affordance (border intensification + `↗` indicator glow; the pre-UAT-F1 `NAV · UNDER THE HOOD` tooltip was removed in F1 because the instrument-as-nav conceit stands on its own); (2) a once-per-session first-session hint pulse ring expands from the `SessionPulse` after ~3s of homepage idle, dismissed on any interaction, gated via `sessionStorage`, with a static-text fallback under `prefers-reduced-motion`; (3) the footer on every page carries conventional nav links as the cheap escape hatch. No backup hamburger is added — the footer plus Overview tab (post-UAT F1 rename; originally "Session State tab") are the designed escapes. The `SessionPulse` stays reachable on `/demo/ecommerce/*` so the overlay remains available on demo pages.

**Overlay restructure.** Default tab on open is the **Overview** tab (post-UAT F1 rename; originally "Session State"). Tabs in order: Overview, Timeline, Consent. The pre-9E `Dashboards` tab, the `HomepageUnderside` component, and the `/demo/ecommerce/*` pathname-specific `EcommerceUnderside` routing are removed — the overlay no longer carries demo-specific content in 9E. The CRT boot sequence, scanlines, Escape-key close (post-UAT F3; pre-F3 a `-z-10` backdrop-click button was intended but never functional), and "Back to site" button are unchanged. Retrofuture treatment pushes slightly further in the chrome (terminal-style brackets on active tab labels — `[ OVERVIEW ]`, amber-glow timestamps in Timeline). Body content stays warm cream.

**`SessionState` data model.** New client-side state blob persisted to `sessionStorage` at key `iampatterson.session_state`, scoped to tab lifetime (returning visitors start fresh, aligned with the `_iap_sid` cookie's semantics).

```typescript
interface SessionState {
  session_id: string;                          // matches _iap_sid (reconciled on hydrate)
  started_at: string;                          // ISO 8601
  page_count: number;                          // unique page paths visited
  visited_paths: string[];                     // internal — backs page_count across reloads; NOT transmitted in ride-along
  events_fired: { [event_name: string]: number };
  event_type_coverage: {
    fired: string[];                           // distinct event names fired
    total: string[];                           // derived at module init from DATA_LAYER_EVENT_NAMES in schema.ts — no hardcoded count; reconciled on hydrate
  };
  demo_progress: {
    ecommerce: {
      // Monotonic set ordered by first-reached. Consumers render via ECOMMERCE_FUNNEL_SEQUENCE + .includes, not iteration.
      stages_reached: ('product_view' | 'add_to_cart' | 'begin_checkout' | 'purchase')[];
      percentage: number;                      // stages_reached.length / 4 * 100
    };
  };
  consent_snapshot: {
    analytics: 'granted' | 'denied';
    marketing: 'granted' | 'denied';
    preferences: 'granted' | 'denied';
  };
  // Thresholds (subset of [25, 50, 75, 100]) the visitor has crossed this session.
  // Monotonic; excluded from the ride-along projection.
  coverage_milestones_fired: (25 | 50 | 75 | 100)[];
  updated_at: string;                          // ISO 8601
}
```

**Coverage milestone emission (Phase 9E deliverable 3).** The reducer detects newly-crossed thresholds inside `deriveNext` after recomputing the coverage ratio; `SessionStateProvider` watches `state.coverage_milestones_fired` via a ref-based dedup and emits `coverage_milestone` data-layer events (through `trackCoverageMilestone` in `track.ts`) for entries that are newly appearing. Rehydrated entries are pre-seeded into the ref on mount so a tab reload at, say, `[25, 50]` doesn't re-fire those thresholds — only the next crossing (75) will emit. The memoization lives in the persisted blob so the guarantee survives sessionStorage round-trips across the tab's lifetime.

**Rehydration contract.** The provider's mount effect runs `reconcileRehydrated(loaded, currentSessionId)` before setting state. This replaces `event_type_coverage.total` with the live `DATA_LAYER_EVENT_NAMES` array (so a tab open across a deploy that extended the schema sees the live denominator, not the pre-deploy one), updates `session_id` to the current `_iap_sid` cookie value (which rotates every 30 minutes of idle — sessionStorage is tab-lifetime), and drops event names no longer present in the live schema from BOTH `event_type_coverage.fired` AND the keys of `events_fired` — the two fields stay in lockstep so consumers iterating one see the same name set as consumers iterating the other. Other fields (`visited_paths`, `demo_progress`, `consent_snapshot`, timestamps) are preserved verbatim. On the fast-path where reconciliation finds nothing stale, the function returns the loaded reference unchanged and the provider skips the redundant `sessionStorage` write. Persisted-blob validation (`hasValidShape` in `storage.ts`) also enforces the `fired ⊆ total` invariant at load so reconciliation never has to repair that particular breakage. On a fresh session (no prior blob), `consent_snapshot` is seeded from Cookiebot via `getCurrentConsent()` in `src/lib/events/track.ts`, and re-read on the first poll tick to heal the slow-Cookiebot-load case without waiting for an `iap_source` event.

**Ride-along projection.** The optional contact-form ride-along (deliverable 8, deferred by default in 9E) goes through `toRideAlongPayload(state)` in `src/lib/session-state/ride-along.ts` — a narrow projection that includes only `session_id`, `event_types_triggered` / `event_types_total`, `ecommerce_demo_percentage`, `pages_visited` (count, not path history), and the consent snapshot. `visited_paths` is deliberately **not** transmitted. UAT F8 narrowed both `event_types_triggered` and `event_types_total` to filter through `RENDERABLE_EVENT_NAMES` rather than the full schema so the transmitted numbers exactly match the denominator the visitor saw on the Overview tab (20 post-F2, not the schema-level 24). Any future code path that serializes session state across a network boundary must use this helper, not `JSON.stringify` the whole blob.

A single listener subscribes to the same data-layer source that populates the existing `useDataLayerEvents` / `useLiveEvents` buffer. On every event the listener updates the blob — the existing event buffer is unchanged. The `event_type_coverage.total` field stores the full schema list (`DATA_LAYER_EVENT_NAMES`, 24 literals post-F2) read at module init — the single source of truth for event-name iteration, cross-checked at compile time against the `DataLayerEvent` union via the `_AssertEventNamesInSync` sentinel. The Overview chip grid and ride-along payload both read from the narrower `RENDERABLE_EVENT_NAMES` subset (20 literals post-F2), which excludes the 4 subscription/leadgen event types (`plan_select`, `trial_signup`, `form_complete`, `lead_qualify`) that no current surface can fire. The full list today: `page_view`, `scroll_depth`, `click_nav`, `click_cta`, `form_field_focus`, `form_start`, `form_submit`, `consent_update`, `product_view`, `add_to_cart`, `begin_checkout`, `purchase`, `plan_select`, `trial_signup`, `form_complete`, `lead_qualify`, `nav_hint_shown`, `nav_hint_dismissed`, `session_pulse_hover`, `overview_tab_view` (post-UAT F1 rename; originally `session_state_tab_view`), `timeline_tab_view` (added in F2), `consent_tab_view` (added in F2), `portal_click`, `coverage_milestone`. No implementation state hardcodes `16`, `22`, `24`, or `20` as a magic number anywhere in the coverage path — renderable count reads from `RENDERABLE_EVENT_NAMES.length`; schema count reads from `DATA_LAYER_EVENT_NAMES.length`. The 4 hidden event-types stay in the schema + BigQuery columns so their type definitions and historical column data survive until those demos return. Demo-progress stages are monotonic within a session (stages reached cannot be un-reached). The Overview tab renders against this blob; an optional deliverable serializes the renderable-subset projection onto the contact form as a ride-along payload, gated by an explicit consent-aware checkbox.

**Pipeline-section bleed-through architecture.** The homepage pipeline section becomes a scroll-coupled progressive-reveal surface. The `<section id="pipeline">` stacks a two-column header, the `PipelineEditorial` schematic (5 stages + session event log), and an escape-hatch CTA. Four absolutely-positioned `aria-hidden` sibling divs sit above the paper background and below the content: `.bleed-scanlines` (horizontal CRT raster, vertical drift), `.bleed-phosphor` (amber bloom from the bottom, breathing), `.bleed-vignette` (darkened corners, curved-tube effect), `.bleed-rgb` (chromatic aberration band that sweeps top→bottom only at `hot` tier). All four read `var(--bleed)` for opacity.

Bleed ramp math is anchored to the section's own height, not a viewport fraction — tracking viewport distance instead would cause the amber to peak before the reader finishes. Using `rect = el.getBoundingClientRect()`, `vh = window.innerHeight`, and `h = el.offsetHeight`:

```
enter = vh * 0.25
peak  = vh * 0.95 - h
p     = 1 - clamp((rect.top - peak) / (enter - peak), 0, 1)
bleed = p * p                                  // p² ease-in
el.style.setProperty('--bleed', bleed.toFixed(3));
```

Tier state machine (React re-renders only when the class changes): `bleed > 0.85` → `peak hot`; `> 0.55` → `hot`; `> 0.18` → `warm`; else no class. `--bleed` writes happen inside a `requestAnimationFrame` loop paused when the section leaves the viewport via `IntersectionObserver`. Flicker bursts at tier ≥ 1 schedule on a random cadence: `delay = 240 + (1 - bleed) * 2200 + rand() * 400` ms, `duration = 90 + rand() * 120` ms. The `.flick` class adds phosphor brightness boost, scanline shift, a 0.5px diagram translate, and red/cyan chromatic text-shadow on heading / meta / log. The stage-rotation interval is 1800ms linear with wrap, disabled under `prefers-reduced-motion`. The session event log continues to feed from `useLiveEvents` — no new data source.

**Accent-swap ownership.** The app shell (not the section) owns the `--accent` imperative swap on overlay open/close. The pipeline section's CTA and hot-stage emphasis read `--accent` through `color-mix(in oklab, #FFA400 calc(var(--bleed) * N%), var(--accent))` so the persimmon → phosphor amber transition is continuous with the scroll-driven bleed rather than a discrete toggle. Two places setting `--accent` would flicker; keep shell ownership.

**Component topology.** New: `SessionPulse` nav upgrade (hover affordance + first-session hint), `OverviewTab` (post-UAT F1; originally `SessionStateTab`), `SessionStateProvider` (listener + `sessionStorage` orchestration — domain name preserved since it describes the data model, not the tab), `PipelineSection` + `PipelineEditorial` (replacing today's pipeline component), `OverlayView` (post-UAT F1; originally `UnderTheHoodView`), `HomeBar` (post-UAT F5 — slim back-to-homepage affordance below LiveStrip on non-homepage / non-demo routes). Removed: `MobileSheet`, `HomepageUnderside`, `EcommerceUnderside`, `CampaignTaxonomyUnderside`, `StagingLayerUnderside`, `DataQualityUnderside`, `WarehouseWriteUnderside`, `Tier3Underside` (some of their display content is salvaged into Phase 9F's pattern language, not ported), the overlay's pre-9E `Dashboards` tab, the three-card `DemosSection`, the `/demo/subscription` and `/demo/leadgen` route trees and their supporting data libraries and dashboard components.

**Accent and motion constraints.** Editorial persimmon stays the paper accent; phosphor amber stays the underside accent. Amber on the homepage is restricted to bleed-through layers and the `SessionPulse` surface itself — no editorial surface adopts amber as its primary accent. `prefers-reduced-motion` disables all time-based animations across the pivot (scanline drift, phosphor breathe, RGB sweep, flicker bursts, stage rotation, peak jitter, CTA halo / jitter, Session-State typing animation, first-session pulse ring). Bleed layers may still render statically and tier thresholds still fire on scroll; only the time-driven motion is suppressed.

**Nav & Overview analytics.** 9E deliverable 9 extends `src/lib/events/schema.ts` with six new event interfaces and adds them to the `DataLayerEvent` union: `NavHintShownEvent`, `NavHintDismissedEvent` (`dismissal_mode: 'scroll' | 'click_outside' | 'timeout'` — three values covering the non-conversion dismissal paths; pre-UAT a fourth value `click_session_pulse` existed for clicks on the SessionPulse element but was removed post-UAT because those clicks are *conversions*, tracked by `click_cta` with `cta_location: 'session_pulse'`. Conflating them produced a dismissal metric that couldn't distinguish abandonment from engagement. The hint still hides visually on SessionPulse click, just without emitting the dismissal event), `SessionPulseHoverEvent` (desktop-only, 60s debounce, coarse-pointer suppressed), `OverviewTabViewEvent` (post-UAT F1 rename; originally `SessionStateTabViewEvent`; `source: 'default_landing' | 'manual_select'`), `PortalClickEvent` (`destination: 'services' | 'about' | 'contact'`), and `CoverageMilestoneEvent` (`threshold: 25 | 50 | 75 | 100`, monotonic within a session). UAT F2 added two peers: `TimelineTabViewEvent` + `ConsentTabViewEvent` with identical `source` semantics — each tab gets its own coverage chip so the meter rewards depth-of-exploration. The `click_cta` event's `cta_location` field is a closed enum for 9E: `'session_pulse' | 'portal_services' | 'portal_about' | 'portal_contact' | 'contact_cta_threshold' | 'pipeline_see_your_session' | 'footer_session'` — seven values, enforced at the type level via the `CtaLocation` union exported from `src/lib/events/schema.ts` (post-UAT F1: `pipeline_watch_it_live` → `pipeline_see_your_session`; `footer_under_the_hood` → `footer_session`). Any additional nav-adjacent CTA added during implementation extends the union explicitly rather than slipping in as a free-form string. `ClickCtaEvent.cta_location: CtaLocation` (not `string`) guarantees call-site enforcement. All events are analytics-only with no PII and flow through the standard data-layer / GTM / sGTM / BigQuery pipeline — no new destinations and no new infrastructure. The `DataLayerEvent` union grew from 16 pre-9E → 22 post-D9 → 24 post-UAT F2. The Overview coverage denominator renders from `RENDERABLE_EVENT_NAMES` (post-UAT F2) which excludes the 4 sub/leadgen event types that no current surface can fire — visitors see a denominator of 20, not 24 (the type definitions persist in the schema for future reintroduction and BigQuery column continuity). This deliverable is accelerated from Phase 10 because the gamification loop's success depends on visitors actually reaching the Overview tab — validating that bet after ship requires the instrumentation to land with the nav pivot, not months later.

**What's deliberately unchanged.** `useEventStream` / `useLiveEvents` hooks, the SSE Cloud Run service, the `_iap_sid` session cookie, GTM / sGTM / Pub/Sub, BigQuery, Dataform, Metabase, and the Phase 9B signed-embed signer are all unchanged in 9E. Event schema (`src/lib/events/schema.ts`) is extended by D9's six nav-analytics events + UAT F2's two tab-view peers (`TimelineTabViewEvent`, `ConsentTabViewEvent`); all pre-existing event interfaces persist and the UI firing subscription / leadgen events is removed (the type definitions for subscription / leadgen events themselves stay in the schema + BigQuery columns until those demos return — the UAT F2 `RENDERABLE_EVENT_NAMES` subset hides them from the Overview chip grid while preserving the BQ column continuity).

### Phase 9F — Ecommerce Demo Native-Reveal Rebuild

Rebuilds the ecommerce demo's Tier 2/3 reveal mechanics using the four-pattern native-reveal language specified in `docs/UX_PIVOT_SPEC.md` §3.5. Ships jointly with Phase 9E per the 9E block's release coupling. The phase replaces the overlay-based per-page `*Underside` content with in-flow reveals that live inside the demo pages, and replaces the three-individual-question Metabase confirmation embed with a single full-dashboard embed. Simultaneously, the demo adopts the hi-fi Tuna Shop brand treatment (demo-scoped editorial palette, prototype-verbatim voice rules, 6-SKU catalog mirroring `tunameltsmyheart.com`) from the reference implementation at `docs/input_artifacts/design_handoff_ecommerce/`.

**Four-pattern component topology.**

```
src/components/demo/reveal/
├── event-toast.tsx          # Pattern 1 — non-blocking notification
├── live-sidebar.tsx         # Pattern 2 — collapsible Tier 2 panel
├── inline-diagnostic.tsx    # Pattern 3 — styled wrapper for inline blocks
├── full-page-diagnostic.tsx # Pattern 4 — full-bleed transitional moment (one total)
└── toast-provider.tsx       # Portal + useToast() imperative API

src/lib/demo/reveal/
├── campaign-taxonomy.ts     # UTM classifier + display (salvaged from CampaignTaxonomyUnderside)
├── staging-layer.ts         # Staging transformation shape (salvaged from StagingLayerUnderside)
├── data-quality.ts          # Assertion list + failure messages (salvaged from DataQualityUnderside)
├── warehouse-write.ts       # BigQuery row preview (salvaged from WarehouseWriteUnderside)
└── dashboard-payoff.ts      # Confirmation-page narrative + embed-shape helpers
```

Pattern 1 (`EventToast`) renders into a portal rooted at `src/app/layout.tsx` so stacking context is independent of the consuming page's layout and the portal outlives App Router route transitions; a `ToastProvider` at the demo-layout root owns the portal and exposes an imperative `useToast()` API callers invoke (callers never manage toast lifecycle directly). `aria-live="polite"` announces the event to screen readers without stealing focus. Multiple toasts stack vertically (newest at top, max 3 visible, older toasts dropped rather than queued). On route change, in-flight toasts are cancelled immediately. Motion: 220ms entry (slide-down + fade), 180ms exit (fade). Under `prefers-reduced-motion` the 2–2.6-second lifetime is preserved but fade transitions become instant. Pattern 2 (`LiveSidebar`) is position-relative / sticky, not fixed — the sidebar scrolls with page content. Desktop breakpoint for the right-side rail is ≥1024px (the prototype's breakpoint); below that, the sidebar becomes a top accordion above the page content. Per-page default: open on product detail, cart, and checkout; collapse state does NOT persist across routes (each page re-presents its Tier 2 content open-by-default) but MAY persist within the current route via `sessionStorage` key `iampatterson.sidebar.collapsed.<route>` so mid-page re-renders don't force-reopen. Pattern 3 (`InlineDiagnostic`) is a thin styled wrapper that applies the token set (dark background, amber headers, `>` prompt prefixes, terminal-style rules) and composes arbitrary children — callers (deliverables 8 warehouse-write sidebar, 9 confirmation-page payoff) own content shape. Pattern 4 (`FullPageDiagnostic`) is the one full-bleed transitional moment; orchestrated via Next.js App Router `useRouter` — render the diagnostic, run the typed sequence, then `router.push` + `cart.clear()`. Keyboard-skippable (`keydown` on `document`, any key) so users aren't trapped; backdrop click does NOT skip; touch visitors auto-advance in ~1.9s; skipped entirely under `prefers-reduced-motion`. `role="dialog"` with focus trap active during the moment.

**Per-page pattern assignments (ecommerce).**

| Route | Pattern(s) | Salvage source |
|---|---|---|
| `/demo/ecommerce` | Toast cascade (session_start + taxonomy_classified + view_item_list, `viewport-top`) | `CampaignTaxonomyUnderside` |
| `/demo/ecommerce/[productId]` | Toast (product_view, `near-product`) + Sidebar | `StagingLayerUnderside` |
| `/demo/ecommerce/cart` | Toast (view_cart) + Sidebar | `DataQualityUnderside` |
| `/demo/ecommerce/checkout` | Toast (begin_checkout) + Sidebar + Full-page moment on submit | `WarehouseWriteUnderside` |
| `/demo/ecommerce/confirmation` | Toast (purchase) + Inline diagnostic + full-dashboard Metabase embed | today's three `LiveEmbedFrame` instances + overlay Dashboards-tab fallback |

The five `*Underside` components and the `EcommerceUnderside` router wrapper are deleted at the end of deliverable 10 (if any aren't already gone from 9E D2). Their display content migrates into the reveal components per the table; utility logic (UTM classification lookup, staging-layer field-cast rules, assertion list, BigQuery row-schema preview) migrates into `src/lib/demo/reveal/`.

**Confirmation-page Metabase payoff — embed-shape decision.** Phase 9F locks the open decision from `docs/UX_PIVOT_SPEC.md` §3.5: **one full-dashboard embed, not six individual question embeds.** Rationale: the confirmation page is the Tier 3 *payoff* surface, not a collection of charts; a single production-BI canvas is a stronger proof-of-tier than six scattered question-embeds with per-chart narrative, and Metabase dashboards are designed to be read as cohesive surfaces rather than split into per-chart frames. The signing flow from Phase 9B deliverable 6b is retained but adapted: the Next.js Server Component now mints **one** HS256 JWT against Metabase's `/embed/dashboard/:jwt` path instead of three JWTs against `/embed/question/:jwt`:

```
payload = { resource: { dashboard: <dashboardId> }, params: {}, exp: now + 600 }
url     = `https://bi.iampatterson.com/embed/dashboard/${jwt}#bordered=true&titled=false`
```

`METABASE_EMBED_CONFIG.dashboardId` (already present per 9B-infra Task 5) carries the correct dashboard ID. The `cardIds` subfields are no longer load-bearing at render time — they may stay for fallback/observability or be removed in deliverable 10's cleanup. `MB_EMBEDDING_SECRET_KEY` is unchanged. The 10-minute TTL is unchanged. The IAP-gated `/dashboard/2` deep-link fallback from 9B is removed from desktop / tablet — the `/embed/*` URL-map path from 9B-infra Task 5 loads the full dashboard anonymously. A visible "View full dashboard → (Google SSO required — internal BI)" link is retained below the embed on mobile (<768px) as an honest "here's where this lives in production" affordance, not an escape hatch to additional content.

The confirmation page layout widens from its current constrained width to `max-w-[1200px]` at ≥1024px so Metabase's 2–3 column dashboard grid renders at its intended layout. Between 768px and 1024px, the embed renders at 100% of the available width with Metabase reflowing to a single-column stack. Below 768px, same single-column reflow with taller iframe + the IAP-gated deep-link affordance described above. The per-order narrative (the `$total` interpolation and "you just converted" framing) sits in a single lead paragraph *above* the dashboard embed — the visual rhythm changes from "paragraph → chart → paragraph → chart" to "paragraph → full-dashboard canvas." The dashboard embed is wrapped in the Pattern 3 `InlineDiagnostic` so the payoff block reads visually continuous with the demo's reveal aesthetic (amber headers, terminal-style separators framing the canvas).

**Cold-start ship-gate (binary release blocker).** The full-dashboard embed hits the same Metabase Cloud Run JVM path as today's three question-embeds, but the failure mode is more jarring because the payoff surface has higher visual weight than three smaller iframes. **9F does not merge to the joint 9E+9F release branch until:** (a) 9B operational follow-up #1 is applied — `gcloud run services update metabase --region=us-central1 --project=iampatterson --no-cpu-throttling` (~$20/mo cost delta); (b) a cold-start probe from a fresh tab after ≥15 minutes of verifiable Metabase idleness (Cloud Run request logs empty, or temporarily `--min-instances=0`) loads the confirmation page's full-dashboard embed in under 10 seconds to first paint, 15 seconds to interactive; (c) the probe result is recorded in the session handoff. This is a binary release gate, not a soft caveat.

**Brand treatment (Tuna Shop, demo-scoped).** Phase 9F inherits `docs/input_artifacts/design_handoff_ecommerce/` as the high-fidelity reference. The demo root sets `data-demo="ecommerce"` (existing `DemoThemeProvider` pattern from Phase 8); the attribute is the scope anchor for the shop's palette override. Shop palette: `--shop-cream #FBF6EA` (page bg), `--shop-cream-2 #F5EEDB` (card tint), `--shop-amber #E6B769` (secondary), `--shop-amber-2 #C4703A` (terracotta primary, overriding `--accent`), `--shop-warm-brown #5C4A3D` (secondary depth). Terminal palette for reveal-pattern surfaces: `--term-bg #0D0B09`, `--term-ink #EAD9BC`, `--term-amber #F3C769`, status `--term-ok #8FBF7A` / `--term-warn #E6A94A` / `--term-err #D9725B`. The terminal warm amber (`#F3C769`) differs from the site-wide phosphor amber (`#FFA400`) by design — per the prototype README, "terminal surfaces should feel like the inverse of the shop, not a separate environment." UX_PIVOT_SPEC §1.4 "no editorial surface adopts amber as primary" is preserved: the shop's primary is terracotta, not amber; amber remains reserved for underside/terminal/diagnostic surfaces. Typography: Instrument Serif for display (H1, product names, section headings), Plus Jakarta Sans for body / buttons / nav, JetBrains Mono for event names / parameter keys / BQ columns / eyebrows — already loaded site-wide, demo inherits. Brand voice rules (prototype-verbatim): all-lowercase headings and body copy (proper nouns / acronyms stay cased); no em dashes; no rule-of-three adjective lists; no "serves as" / "stands as" / "marks"; reuse the same word rather than synonym-cycling; first-person plural when the shop voices itself; no-kill rescues mention on footer / product detail / confirmation (not hero).

**Z-index budget for reveal layers.** Five overlay-layer surfaces coexist on demo pages. Ordering (highest → lowest):

1. Cookiebot CMP banner — compliance surface, must always be reachable
2. 9E Session overlay (SessionPulse-triggered) — covers the whole site when open
3. Pattern 4 full-page diagnostic — the 1.5–1.9s transition moment
4. Pattern 1 event toasts — above page content and sidebars
5. Pattern 2 live sidebar — scrolls with page content, above page content only

Assign explicit z-index tokens in `tailwind.config.ts` (`z-cookiebot`, `z-overlay`, `z-full-page-diagnostic`, `z-toast`, `z-sidebar`) rather than ad-hoc numeric values so the ordering is maintainable. Predictable collisions resolve naturally by the ordering above (toasts clear off-screen when the overlay opens; Cookiebot takes priority on re-open; full-page diagnostic covers any in-flight toast).

**Header topology on demo pages.** The site header (`SessionPulse`-only nav + `LiveStrip` + `HomeBar`) renders above the demo's own `EcomHeader` (brand mark + shop/cart nav) — the two stacks read as "site chrome (session-scoped nav)" over "demo chrome (shop-scoped nav)." This preserves both the 9E nav pivot's instrument-as-nav framing and the shop's believable storefront presence. The overlay stays reachable from the `SessionPulse` on every demo page (9E constraint); the demo's own header carries only demo-scoped links (`shop`, `cart`, back-to-site).

**Palette-token harmony pass.** Demo surfaces currently use raw `neutral-*` Tailwind classes; editorial surfaces use the `ink / paper / rule` token scale. 9F's deliverable 12 folds the unified palette pass into the demo rebuild — migrate `neutral-*` to `ink / paper / rule` where the editorial system applies, preserve ecommerce-specific warmth (product imagery tint, terracotta highlights on storefront CTAs). This addresses Phase 9B follow-up #3 as part of the phase that already touches every demo page.

**What's deliberately unchanged in 9F.** Event schemas (`src/lib/events/schema.ts`) — 9F consumes existing events, does not add new ones (nav-analytics events are scoped to 9E deliverable 9). SSE Cloud Run service, `_iap_sid` cookie, GTM, sGTM, Pub/Sub, BigQuery, Dataform, Metabase deployment. The 9B-infra IAP / backend-direct URL-map split. The `MB_EMBEDDING_SECRET_KEY` / `METABASE_EMBED_CONFIG` Vercel env contract.

### Phase 8 — Attribution
Shapley value MTA in Dataform. Comparison views against last-click and platform-reported.

### Phase 9 — Polish
Performance, mobile testing, error handling, security review, SEO.