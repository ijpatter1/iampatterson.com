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

**Client-side GTM container:**

- Loads via `<Script>` in root layout
- Contains a minimal set of tags — most processing happens in sGTM
- Key tags: Cookiebot integration, data layer listener, sGTM transport
- All event parameters are pushed to the data layer by application code, not extracted by GTM

**Server-side GTM (sGTM) on Stape:**

- Custom domain configured for same-origin (e.g., `sgtm.iampatterson.com`) to avoid ad blockers and ensure first-party cookie context
- Stape handles the sGTM container hosting
- sGTM receives all events from the client-side container
- sGTM routes events to:
  - GA4 (Measurement Protocol)
  - BigQuery (BigQuery API tag)
  - Pub/Sub (custom tag — Phase 2)
  - Meta CAPI (simulated — Phase 6)
  - Google Ads Enhanced Conversions (simulated — Phase 6)

### BigQuery Event Sink

**Dataset:** `iampatterson_raw`
**Table:** `events_raw`
**Tag:** Stape "Write to BigQuery" community template (`docs/template.tpl`)
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

### Phase 8 — Attribution
Shapley value MTA in Dataform. Comparison views against last-click and platform-reported.

### Phase 9 — Polish
Performance, mobile testing, error handling, security review, SEO.