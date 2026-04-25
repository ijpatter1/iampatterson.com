# SEO Content Plan — 2026-04-25

Phase 10d D4 deliverable. Pre-launch SEO posture + a sketch of
post-launch content directions. This is a strategy doc, not a
roadmap commitment — the post-launch articles are candidate topics,
not a publishing schedule.

---

## Part 1 — Pre-launch posture

### Per-route metadata in place

| Route | Title | Description | OG | Twitter | Canonical |
|---|---|---|---|---|---|
| `/` | Patterson Consulting | site description | site default | summary_large_image | yes |
| `/services` | Services | tier description | yes (type=website) | summary_large_image | yes |
| `/about` | About | bio + perspective | yes (type=profile) | summary_large_image | yes |
| `/contact` | Contact | conversation framing | yes (type=website) | summary_large_image | yes |
| `/demo/ecommerce` | The Tuna Shop — Live Ecommerce Demo | live-demo framing | yes (type=website) | summary_large_image | yes |

Per-product detail pages (`/demo/ecommerce/[productId]`) inherit the
ecommerce-layout metadata as a base; the product's own title/desc come
from the product detail page's existing in-page metadata via the
`generateMetadata` route convention if/when needed (currently they
inherit, which is the right default for a demo subtree).

### Structured data

Two JSON-LD blocks inlined in the root `<head>`:

- **Organization** — `Patterson Consulting`, founder linked to Person,
  contact point set
- **Person** — `Ian Patterson`, jobTitle, knowsAbout list,
  worksFor → Organization

Builder lives at `src/lib/seo/json-ld.ts`. Editing canonical claims
about the consultancy's framing, contact info, or expertise list goes
there.

### Sitemap

Generated at `src/app/sitemap.ts`. 12 entries: 6 canonical static
pages + 6 product detail pages from the catalog.

**Excluded** (intentional): cart, checkout, confirmation,
`/contact/thanks`, `/demo/ecommerce/analytics`. Session-scoped or
post-conversion pages whose standalone-landing value is zero or
negative.

### Robots

`/robots.txt` allows all crawlers with explicit `Disallow` entries
for the same four session-scoped routes excluded from the sitemap.
Sitemap URL signaled via `Sitemap:` line.

### Open Graph image

`/opengraph-image` route renders a 1200×630 `ImageResponse`-driven
PNG carrying the hero thesis ("I build / measurement / infrastructure.")
on the site's paper background with the persimmon accent. Generated
at request time so we ship no committed binary asset.

Per-route OG images can override by adding `opengraph-image.tsx` to
the route segment. None do today; all routes use the default until a
specific route surfaces a need.

### `metadataBase`

Set to `https://iampatterson.com/` on root layout so all OG / Twitter
relative URLs resolve correctly when rendered in social preview cards.

---

## Part 2 — Target audience and intent

The site targets two populations:

### A. Marketing executives evaluating a consultant

**Search intents most likely to land here:**

- "marketing measurement consultant" / "marketing analytics
  consultant"
- "server-side tagging consultant" / "sGTM consultant"
- "BigQuery for marketing teams"
- "GA4 implementation help"
- "Cookiebot + GTM Consent Mode"
- "marketing data warehouse setup"
- "[my agency name] marketing measurement vendor evaluation"

**What they want from a landing page:** evidence the consultant has
done this before, an honest scope of what's offered (which is what
`/services`'s tier structure provides), and a low-friction next step
(`/contact`). The site's "your session is the portfolio" thesis is
the differentiator vs. generic marketing-agency landing pages.

### B. Data leaders / engineers evaluating implementation

**Search intents most likely to land here:**

- "server-side GTM setup" / "self-hosted sGTM Cloud Run"
- "GTM Consent Mode v2 implementation"
- "BigQuery event schema for ecommerce"
- "Dataform ecommerce models"
- "Metabase BigQuery setup" / "Metabase IAP"
- "marketing measurement architecture"

**What they want from a landing page:** working implementations they
can read or replicate. The architecture surface this site demonstrates
(the live overlay, the BQ row preview on confirmation, the Tuna Shop
walkthrough) is exactly the proof a technical buyer wants.

### Page-by-page intent map

| Page | Primary intent | Secondary intent |
|---|---|---|
| `/` | "who is this person, can they help me" | demo curiosity |
| `/services` | "what specifically do they offer" | tier comparison |
| `/about` | "is this person legitimate" | personal connection |
| `/contact` | "how do I start a conversation" | qualify mutual fit |
| `/demo/ecommerce` | "show me the implementation" | technical evaluation |

---

## Part 3 — Post-launch content directions

These are candidate topics, not commitments. Each is a 1500–3000 word
article that could serve as either a portfolio long-form piece or a
publishable post.

### Tier 1 — high-intent, "proof of expertise" content

1. **Why your sGTM container is leaking PII (and how to find out)** —
   a walkthrough using the actual GTM consent-gating pattern this site
   ships. Differentiator vs. generic GTM blogs: it shows the auditing
   tooling, not just the rules.

2. **Cookiebot + Consent Mode v2: the explicit bridge pattern** —
   based on the Phase 1 D3 architectural amendment work. The auto-
   blockingmode-vs-manual-blockingmode trade-off + the explicit
   `bridgeToGtagConsent` helper. Solves a real, googlable problem
   (React-19/Next-16 hydration mismatch).

3. **The shape of an honest BigQuery event schema** — walking through
   the union-of-discriminated-events pattern in
   `src/lib/events/schema.ts`. The 26-event union, the runtime+compile-
   time cross-checks, the "every consumer derives from the array"
   discipline.

### Tier 2 — "this site is the demo"

4. **Why this consulting site is wired through its own measurement
   stack** — the meta-narrative. Differentiator: most consulting sites
   talk about measurement in the abstract; this one ships the stack
   live.

5. **What the "make the invisible visible" overlay actually shows** —
   tour the Session overlay's three tabs (Overview, Timeline, Consent)
   + the D9 storage inspector. Frame as "the demo the site is, not
   the demo the site has."

### Tier 3 — technical depth, longer tail

6. **Phase 11 D9: declarative infra-deploy reconciler design** — a
   thinking-out-loud post once Phase 11 D9 lands. Pulls from the
   security review's Important finding: runtime SA bindings should be
   in repo, not in operator memory.

7. **Dataform on a one-person consulting site: dataset layer
   discipline** — raw → staging → marts walked through the actual
   `infrastructure/dataform/` definitions. Sells the discipline by
   showing the file count.

8. **The 9F native-reveal pattern: why we cut the overlay in the
   ecommerce demo** — the architectural pivot that traded one heavy
   abstraction (overlay-everywhere) for four lightweight in-context
   patterns (toast, sidebar, inline diagnostic, full-page diagnostic).

### Tier 4 — opinions, taste-distinguishers

9. **The four kinds of "AI in marketing measurement" that aren't
   actually AI** — opinionated taxonomy. Differentiator: most "AI for
   marketers" content is uncritically pro; this is honest about what's
   linear regression with a wrapper.

10. **Why I don't run my own sGTM container in production for clients
    until the third engagement** — the honest "what tier I'd actually
    sell" piece. Risks alienating low-tier prospects but cements
    trust with high-tier ones.

---

## Part 4 — Operator pre-launch checklist

Before launching:

- [ ] **Verify Open Graph rendering.** Use `https://www.opengraph.xyz/`
      or LinkedIn / Twitter / Facebook debuggers against
      `https://iampatterson.com/` to confirm the `/opengraph-image`
      route renders correctly on each platform.
- [ ] **Submit sitemap to Google Search Console.** Verify ownership
      via DNS TXT (preferred over meta-tag verification so it persists
      across re-deploys).
- [ ] **Submit sitemap to Bing Webmaster Tools.** Same shape.
- [ ] **Verify robots.txt** loads at `https://iampatterson.com/robots.txt`
      and `Sitemap:` line is present.
- [ ] **Test JSON-LD** via Google's Rich Results Test
      (`https://search.google.com/test/rich-results?url=https%3A%2F%2Fiampatterson.com%2F`).
      Both Organization and Person schemas should validate.
- [ ] **Run a Lighthouse SEO audit** on / and /services. Target:
      score 100. Already at 99-100 desktop per the Phase 10b D1b
      baseline, but the SEO sub-score specifically gates on metadata
      presence — re-verify after these changes ship.
- [ ] **Configure Vercel domain redirects.** `www.iampatterson.com` →
      `iampatterson.com` (or vice versa, decide the canonical) so
      duplicate-content signals don't fork.
- [ ] **Verify HSTS** is set on the apex domain. Vercel's default
      should cover it; confirm via `curl -I https://iampatterson.com`.

---

## Part 5 — Out of scope

- **Backlinking outreach.** A cold-outreach plan for a one-person
  consultancy is wildly different from a content-team engagement
  model; not appropriate to scope here.
- **Paid search / paid social.** Outside the launch-prep punch list.
- **Schema.org `Service` markup** for the four tiers. Plausible
  add-on; deferred until there's a real funnel signal that distinct
  per-tier landing-page indexability matters.
- **Dynamic per-product OG images.** Each product detail page could
  generate a custom OG image with the product's image + price. Worth
  adding *if* product pages get organic traffic, which they probably
  won't (the demo is the destination, not the products).

---

## Part 6 — Re-evaluation cadence

Re-run the Lighthouse SEO audit + Google Search Console index
coverage report monthly post-launch. Specifically watch for:

- **Mobile usability errors** — Phase 10d D1 flagged the iPhone-SE
  hero CTA fold soft-fail. If Search Console reports mobile-friendly
  warnings on `/`, escalate per `docs/perf/mobile-matrix-2026-04-25.md`.
- **Core Web Vitals field data** — currently zero (no field-data
  pipeline; `WebVitalEvent` lands in `window.dataLayer` only). Phase
  11 D9 will wire the GTM trigger + GA4 tag, after which CWV reports
  populate in Search Console within ~28 days.
- **Coverage anomalies** — if pages from the disallow list start
  showing up indexed anyway, audit the path-pattern matchers in
  `robots.ts`.
