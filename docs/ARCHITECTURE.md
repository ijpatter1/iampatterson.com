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

**New secrets in this phase:**

- `metabase-api-key` — admin API key used by `apply.sh`. Generated in Metabase UI, stored in Secret Manager.
- `MB_EMBEDDING_SECRET_KEY` — shared secret for signing embed JWTs. Set in Metabase Admin UI; consumed by 6b's Next.js signer.
- `metabase-embed-config` — JSON `{dashboardId, cardIds: {funnel, aov, dailyRevenue}}` produced by `apply.sh`, consumed by 6b.

**Open decisions (blocking 6b, not 6a):**

1. **Embed-path IAP bypass.** Metabase's `/embed/*` endpoints are designed for anonymous public access, but the Phase 9B-infra LB gates everything behind IAP. Three candidates for 6b:
   1. Split the URL map so `/embed/*` routes to a non-IAP backend. Cleanest architecturally; a natural extension of the same path-matcher addendum that 6a requires for `/api/*`. Preferred.
   2. Proxy embeds through the Next.js server with an admin API key. No infra change; adds latency and a new trust boundary.
   3. Static-image embeds rendered at Next.js build time. Simplest; loses interactivity (no drill-down, no filter).

### Phase 9A-redesign — Editorial Design System

Reskin of the Phase 9A surfaces (homepage, `/services`, under-the-hood overlay) per `docs/input_artifacts/iampatterson-com/`. Demo routes and all data-pipeline code are untouched.

**Design tokens.** Instrument Serif joins the existing Plus Jakarta Sans + JetBrains Mono stack as the display face. Accent is a single CSS custom property `--accent` that takes one of two values: persimmon `#EA5F2A` on the marketing/paper surface, phosphor amber `#FFA400` in the under-the-hood overlay. Neutral palette (paper/ink scale) aligns with the clean-slate scale finalized at the end of Phase 9A; no new greyscale tokens are introduced.

**Accent-swap mechanism.** `OverlayProvider` exposes an `overlayOpen` boolean. An effect in the provider (or a dedicated `useAccent` hook) sets `document.documentElement.style.setProperty('--accent', value)` — delayed by ~130ms on open so the flip lands mid-boot (the overlay's own boot phase holds the screen black for ~260ms), and instant on close. Under `prefers-reduced-motion`, the flip is instant on both edges and boot is skipped. The accent is read by any component that wants it via `var(--accent)` in CSS — no React prop threading.

**Overlay architecture.** The overlay is a full-page, position-fixed inset-0 host, not a sidebar or bottom sheet. It has three visual layers composed as siblings inside the host:

1. **Backdrop** — captures outside-click close, no visual treatment.
2. **CRT field** — three non-interactive `aria-hidden` divs stacked: flicker (low-opacity animated luminance wash), bloom (radial glow emanating from center), scanlines (horizontal gradient overlay at ~1.5px period). All three are gated by the `phase-on` state so they don't render during the boot hold.
3. **Overlay panel** — the actual scrollable content surface with the header, tab strip, and tab body.

The boot sequence is two-step: on open, phase goes `idle → boot` (black screen, accent swap initiates); after ~260ms, phase goes `boot → on` and panel content reveals with a one-shot tab-flash animation. On close, phase returns to `idle` and the accent flips back. Under `prefers-reduced-motion`, the `boot` phase is skipped — the panel renders immediately.

**Event-stream integration.** The homepage pipeline-section log feed and the overlay Timeline tab both consume the existing `useEventStream` hook directly. No new pipeline code is introduced. The pipeline log shows the most recent ~5 events; the Timeline tab shows the full session buffer (up to the hook's 100-event cap). Session ID is read from the same `_iap_sid` cookie established in Phase 2.

**Route integration.** The existing Next.js App Router routes (`/`, `/services`, `/about`, `/contact`, `/demo/*`) are preserved. The redesigned chrome (header, live strip, footer) wraps all consulting pages. Demo pages retain their existing Phase 9A `DemoFooterNav` and are not rewrapped. `OverlayProvider` stays route-aware: the overlay is reachable from consulting surfaces; the route guard continues to hide it on `/demo/*` paths so the demo instrumentation story stays contained to the demo's own under-the-hood pattern.

**What's deliberately unchanged.** Ambient event bubbles (Phase 9A Layer 1) stay as-is on consulting surfaces. The session ID cookie mechanism, the `useEventStream` hook, the SSE Cloud Run service, the data-layer event schema, GTM configuration, sGTM, BigQuery tables, Dataform, and all demo front-ends are unchanged.

**Phase 9B status.** Phase 9B is paused while 9A-redesign is in flight. The 9B-infra Metabase deployment (live at `https://bi.iampatterson.com/`) continues to run; only the 9B application-layer deliverables are frozen. The 6a manual apply is deferred until 9A-redesign completes.

### Phase 8 — Attribution
Shapley value MTA in Dataform. Comparison views against last-click and platform-reported.

### Phase 9 — Polish
Performance, mobile testing, error handling, security review, SEO.