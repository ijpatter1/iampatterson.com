# iampatterson.com

Consulting website for Patterson Consulting. Also a working demo of the measurement infrastructure stack described on the site: consent management, server-side GTM, BigQuery event sink, Dataform transformations, and a real-time event pipeline.

Visitors browse a normal consulting site. At any point they can open the "Under the Hood" overlay to see the instrumentation running on their own session: events firing, consent state being enforced, data flowing through the pipeline.

## Tech stack

- Next.js 14 (App Router), TypeScript (strict), Tailwind CSS
- Cookiebot CMP with Consent Mode v2
- Client-side GTM forwarding to server-side GTM (self-hosted on Cloud Run)
- GA4 via sGTM, BigQuery event sink, Pub/Sub for real-time streaming
- Dataform for warehouse transformations (medallion architecture)
- Jest + React Testing Library for unit/component tests, Playwright for E2E
- Deployed on Vercel (frontend), GCP Cloud Run (backend services)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your IDs
npm run dev                   # http://localhost:3000
```

The site runs without any environment variables configured. GTM, Cookiebot, and the SSE pipeline just won't load, which is fine for local UI work.

## Scripts

```bash
npm test              # run all Jest tests
npm test -- --watch   # watch mode
npm test -- --coverage
npm run build         # production build
npm run lint          # ESLint
npm run format        # Prettier
```

## Project structure

```
src/
  app/          Next.js App Router pages
  components/   React components (overlay, demos, scripts)
  lib/          Shared utilities, event schemas, types
  hooks/        Custom React hooks
  styles/       Global styles, Tailwind config
tests/
  unit/         Jest unit tests
  integration/  Pipeline integration tests
  e2e/          Playwright E2E tests
infrastructure/
  gtm/          GTM container specs (web + server)
  sse-service/  Cloud Run SSE relay service
  dataform/     BigQuery transformation models
  bigquery/     Schema definitions, AI access layer scripts
docs/
  REQUIREMENTS.md    Development plan
  ARCHITECTURE.md    Technical architecture
  PHASE_STATUS.md    Phase completion tracker
```

## Demo environments

The site includes three instrumented demo storefronts, all built around the Tuna Melts My Heart brand (a real pet influencer brand with 2M+ followers):

**The Tuna Shop** (e-commerce): Product listing, cart, checkout. Each page's "under the hood" view shows a different tier of the measurement stack: campaign taxonomy, staging transformations, data quality assertions, warehouse writes.

**The Tuna Box** (subscription): Plan selection, trial signup. Demonstrates subscription event lifecycle tracking.

**Tuna Partnerships** (lead gen): Partnership inquiry form. Demonstrates consent-gated routing and form interaction tracking.

All three share the same event pipeline and BigQuery destination. An automated data generator (Cloud Run) produces 18 months of realistic historical data for dashboard demos.

## Measurement pipeline

```
Browser data layer
  -> Client-side GTM (consent check)
  -> Server-side GTM (event processing, same-origin domain)
  -> GA4, BigQuery (events_raw), Pub/Sub
  -> Cloud Run SSE service
  -> Browser overlay (real-time event stream)
```

Consent state from Cookiebot determines which destinations receive each event. The overlay visualizes this routing in real time.

## Testing

All features are built with red/green TDD: test written first, then implementation. Coverage includes components, event schemas, pipeline logic, and data layer pushes. Run `npm test` to see current counts.

## Development phases

The project is built in phases, tracked in `docs/PHASE_STATUS.md`. Phases 1-9A are complete. Current work is on Phase 9B (e-commerce demo tiers 2 and 3). See `docs/REQUIREMENTS.md` for the full plan.

## License

All rights reserved. This is a portfolio project, not open-source software. You're welcome to read the code and reference the architecture, but please don't copy it wholesale for your own consulting site.
