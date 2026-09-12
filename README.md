# iampatterson.com

Consulting website for Patterson Consulting. Also a working demo of the measurement infrastructure stack described on the site: consent management, server-side GTM, BigQuery event sink, Dataform transformations, and a real-time event pipeline.

Visitors browse a normal consulting site. At any point they can open the "Under the Hood" overlay to see the instrumentation running on their own session: events firing, consent state being enforced, data flowing through the pipeline.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS, on Node 24
- Cookiebot CMP with Consent Mode v2
- Client-side GTM forwarding to server-side GTM (self-hosted on Cloud Run)
- GA4 via sGTM, BigQuery event sink, Pub/Sub for real-time streaming
- Dataform for warehouse transformations (medallion architecture)
- Jest + React Testing Library for unit/component tests, Playwright for E2E
- Metabase for the BI layer, embedded into the site with signed JWTs
- Terraform for the GCP infrastructure, applied from CI behind an approval gate
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
npm run test:watch    # watch mode
npm run test:coverage # coverage report
npm run build         # production build
npm run lint          # ESLint
npm run format        # Prettier (format:check to verify without writing)
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
  cloud-run/    Deployed services: event-stream (SSE relay), data-generator, claudish-proxy
  gtm/          GTM container specs (web + server)
  sgtm/         Server-side GTM image and deploy tooling
  dataform/     BigQuery transformation models
  bigquery/     Schema definitions, AI access layer scripts
  metabase/     Metabase deployment, dashboards and embed config
  terraform/    GCP infrastructure as code
  monitoring/   Uptime checks and alert policies
  pubsub/       Real-time event pipeline topics
  retention/    Log and data retention config
docs/
  ARCHITECTURE.md    Technical architecture
  runbook/           Operational procedures
  verification/      Dated records of production checks
  uat/               Executable UAT scripts the e2e suite runs
```

## Demo environments

**The Tuna Shop** is the instrumented demo storefront, built around the Tuna Melts My Heart brand (a real pet influencer brand with 2M+ followers). Product listing, cart, checkout and a post-purchase analytics view. Each page's "under the hood" view shows a different tier of the measurement stack: campaign taxonomy, staging transformations, data quality assertions, warehouse writes, and an embedded Metabase dashboard on the confirmation page.

Two earlier demos — a subscription flow and a lead-gen form — were removed in the 9E redesign and their routes now permanently redirect. An automated data generator (Cloud Run) produces 18 months of realistic historical data for the dashboards.

## Measurement pipeline

```
Browser data layer
  -> Client-side GTM (consent check)
  -> Server-side GTM (event processing, same-origin domain)
  -> GA4, BigQuery (events_raw), Pub/Sub
  -> Cloud Run event-stream service (SSE)
  -> Browser overlay (real-time event stream)
```

Consent state from Cookiebot determines which destinations receive each event. The overlay visualizes this routing in real time.

## Testing

All features are built with red/green TDD: test written first, then implementation. Coverage includes components, event schemas, pipeline logic, and data layer pushes. Run `npm test` to see current counts.

## Development phases

The project was built in phases across two initiatives, both complete. Phases 1 through 10: foundation, real-time event pipeline, the flip-the-card overlay, the background data generator, the data infrastructure, the demo front-ends, the BI/dashboards layer, the frontend redesign, the 9A/9B/9E/9F homepage and ecommerce rebuilds, and Phase 10 (polish, performance, and launch prep — framework currency, Core Web Vitals, voice/data honesty, and the full launch-prep punch list across three UAT rounds). Initiatives 001 and 002 are complete; the plans and session records live in a private control plane.

## License

All rights reserved. This is a portfolio project, not open-source software. You're welcome to read the code and reference the architecture, but please don't copy it wholesale for your own consulting site.
