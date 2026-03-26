# iampatterson.com — Content Guide

## Document Purpose

This guide contains all site content for iampatterson.com, organized by page and section. Content is written to serve two audiences simultaneously: non-technical marketing leaders who need to understand what Patterson Consulting delivers and why it matters, and technical buyers who want to verify depth and credibility. The voice is direct, confident, and practitioner-first — this is someone who builds, not someone who advises from a distance.

---

## Global Elements

### Site Navigation

- Home
- Services
- About
- Demos (dropdown: The Tuna Shop / Tuna Subscription / Tuna Partnerships)
- Contact
- [Flip-the-Card Toggle — persistent, always visible]

### Tagline (used in meta, OG tags, and hero)

**Measurement infrastructure for marketing teams that need to trust their data.**

### Footer

Patterson Consulting — Atlanta, GA
ian@iampatterson.com

Built with the same stack I sell. [Flip the card to see how →]

---

## Page: Home

### Hero Section

**Heading:** Your marketing data is lying to you.

**Subheading:** Platform-reported attribution is self-grading homework. Cookie deprecation is eroding your signal. Your analytics are built on a client-side stack that was designed for 2018. I build the measurement infrastructure that fixes this — from consent and collection through to dashboards and attribution — so your marketing team can finally trust the numbers.

**CTA:** See how it works (links to Services) | Explore a live demo (links to Demos)

### The Problem (Section 2)

**Heading:** The measurement gap is getting wider.

Most marketing teams are running blind and don't know it. They trust platform-reported ROAS numbers that double-count conversions. They rely on cookies that Safari kills after seven days. They pay for analytics tools that can't tell them which marketing is actually working.

The result: budget decisions based on flawed data, attribution models that reward whoever touched the customer last, and no way to answer the question every CMO eventually asks — "what would happen if we turned off spend on this channel?"

This isn't a tools problem. You don't need another dashboard or another analytics vendor. You need measurement infrastructure — a system that collects data properly, stores it in a warehouse you own, transforms it into something trustworthy, and gives you answers you can act on.

That's what I build.

### What I Deliver (Section 3)

**Heading:** End-to-end measurement infrastructure. Not just another tag implementation.

**Measurement Foundation** — Consent management, server-side Google Tag Manager, and event delivery to your ad platforms. Better data quality, longer cookie life, improved match rates, privacy compliance. This is where every engagement starts.

**Data Infrastructure** — Your marketing data in BigQuery, transformed and modeled by Dataform, with AI-native enrichment built into every layer. A single source of truth that replaces the six-platform CSV export your team does every Monday morning.

**Business Intelligence** — Dashboards your team can actually use, AI-powered data exploration, and automated weekly reporting that reads like an analyst wrote it. Built on the infrastructure from the previous phases, not bolted on top of raw data.

**Attribution & Advanced Analytics** — Multi-touch attribution, media mix modeling, and incrementality testing. The only way to honestly answer "what's actually working." Available exclusively to clients whose measurement foundation I've built, because the models are only as good as the data feeding them.

**CTA:** Explore the full service offering →

### The Proof (Section 4)

**Heading:** This site is the case study.

Every page you're browsing right now is instrumented with the same stack I sell to clients. The consent banner, the server-side tracking, the event pipeline into BigQuery, the transformation layer, the dashboards — it's all running live.

Don't take my word for it. Flip the card and watch it work.

Below, three fully functional demos show the stack applied to three different business models — e-commerce, subscription, and lead generation — each with simulated data flowing through every layer from collection to attribution.

**CTA:** Explore the demos →

---

## Page: Services

### Page Introduction

**Heading:** Four tiers. Each one delivers standalone value. Each one makes the next one possible.

I structure engagements as discrete tiers with decision gates between them. You buy what you need, see the results, and decide whether to go further. The first two tiers have non-negotiable components — these are the things that must be done properly or not at all. Everything else is modular and scoped to your specific situation.

### Tier 1 — Measurement Foundation

**Heading:** Tier 1: Measurement Foundation
**Subheading:** Get the data right at the source.

Server-side Google Tag Manager is the backbone of modern measurement. It moves your tracking from the browser to a server you control, which means longer cookie life, higher ad platform match rates, immunity to ad blockers, and proper consent enforcement. Most marketing teams know they should migrate to server-side. Very few have the expertise to do it properly.

**What's included (non-negotiable):**

**Tag Audit & Data Layer Specification** — Before building anything new, I audit your existing client-side GTM container to identify what to keep, what to fix, and what to remove. The output is a documented data layer specification that becomes the blueprint for your server-side implementation. This step is non-negotiable because implementing sGTM on top of a messy client-side container just moves the mess server-side.

**Server-Side GTM Deployment** — Full sGTM container setup with custom domain configuration and same-origin setup for extended cookie life. Hosted on Stape by default, with options for EU-hosted infrastructure or self-hosted on Google Cloud for enterprise requirements.

**Warehouse Event Sink** — Your sGTM event stream flows directly into a data warehouse from day one. This is the bridge to everything downstream — without it, Tier 1 is a dead end and you should hire a GTM specialist, not me.

**Additional components (scoped per client):**

**Consent Management Implementation** — CMP deployment and integration with GTM consent mode, ensuring consent state is enforced server-side. Cookiebot by default, with OneTrust or Didomi for enterprise-scale or multi-brand requirements. Not required if you already have a working CMP.

**Event Delivery Configuration** — Server-side event delivery to your ad platforms. GA4, Meta Conversions API, and Google Ads Enhanced Conversions are the standard package. TikTok Events API, LinkedIn, Pinterest, and Snap are scoped individually based on your channel mix.

**Real-Time Event Architecture** — Your sGTM implementation is designed with awareness of future real-time event streaming capabilities (Pub/Sub, webhooks) even if they're not activated on day one. No architectural decisions that close doors.

**What you get at the end of Tier 1:** Server-side tracking that's properly consented, delivering higher-quality data to your ad platforms and streaming raw events into your warehouse. Better match rates, better attribution signals, privacy compliance, and a foundation for everything that follows.

### Tier 2 — Data Infrastructure

**Heading:** Tier 2: Data Infrastructure
**Subheading:** Turn raw events into a source of truth.

Raw event data in a warehouse is a start, not a finish. Tier 2 transforms that data into a structured, documented, AI-enriched analytics layer that your team and your tools can actually work with. This is where the real value starts compounding.

**What's included (non-negotiable):**

**Warehouse Configuration** — BigQuery project setup with proper dataset structure (raw, staging, marts), IAM permissions, and cost controls. The organizational foundation that prevents your warehouse from becoming an ungoverned data swamp.

**Dataform Transformation Models** — A standardized transformation pipeline following a medallion architecture: raw events are cleaned and flattened in staging, then assembled into business-ready mart tables — campaign performance, channel attribution, customer lifetime value, session events. These models are the intellectual property of the engagement and the single most valuable deliverable. Clients with existing dbt implementations stay on dbt, with a migration conversation available.

**Automated Data Quality Framework** — Dataform assertions that continuously validate your data: schema checks, null rate monitoring, volume anomaly detection, and source freshness verification. This is a standard line item under every quality Dataform implementation, not an optional add-on. Silent data failures are how teams make decisions on broken numbers for weeks before anyone notices.

**Data Dictionary & Schema Documentation** — AI-generated, human-reviewed documentation of every model, every column, every business logic definition, and every upstream dependency. This ships as a deliverable and lives in the Dataform repository. It's what makes your data self-describing — both for your team and for any AI system that needs to work with it.

**AI Access Layer** — A scheduled BigQuery export to Cloud Storage in standard formats (parquet or JSON), providing a clean handoff point for any AI tool — Claude, ChatGPT, Gemini, or your own internal systems — without requiring direct warehouse access. For clients who want direct database connections, a read-only BigQuery service account scoped to mart datasets. LLM-friendly naming conventions are enforced across all models so that any AI system can query your data effectively.

**Additional components (scoped per client):**

**Data Pipeline Deployment** — Ingestion of ad platform spend data, CRM data, and e-commerce platform data into BigQuery. BigQuery Data Transfer Service is the default for supported sources (Google Ads, Shopify, YouTube, Mailchimp). Airbyte for sources not covered by native transfers (Meta Ads, TikTok, Klaviyo, HubSpot) or for clients needing broader connector coverage. Clients with existing ELT tools keep what they have.

**Automated Campaign Taxonomy** — Dataform models using BigQuery's native AI functions to automatically standardize your campaign names, UTM parameters, and ad group naming into a clean, consistent taxonomy. Covers channel classification, campaign type, funnel stage, and product categorization. Includes a validation layer for review and override. Runs continuously as new campaign data flows in, eliminating the eternal spreadsheet-mapping exercise that no one wants to maintain.

**What you get at the end of Tier 2:** A single source of truth for your marketing data. Clean, documented, AI-enriched, and accessible to any downstream tool or AI system. No more Monday morning CSV exports from six platforms. No more "wait, which campaign is that?" in budget meetings.

### Tier 3 — Business Intelligence

**Heading:** Tier 3: Business Intelligence
**Subheading:** Answers, not dashboards.

Dashboards are a means to an end. The end is your team being able to answer questions about marketing performance without filing a ticket, without waiting three days, and without second-guessing the numbers. Tier 3 is entirely modular — you take what you need.

**Components (all modular, scoped per client):**

**Dashboard Design & Build** — Executive summary, channel performance, and campaign drill-down dashboards built on the Tier 2 mart layer. Looker Studio for straightforward reporting needs, or Metabase for embedded dashboards with role-based access and client portal use cases. This is a decision gate based on your security and embedding requirements, not an upgrade path.

**Natural Language Data Exploration** — Gemini-powered querying is available natively in the BigQuery console for technical users. For most marketing teams, the AI Access Layer from Tier 2 enables data exploration through whatever AI tool your team already uses — upload the export to ChatGPT, connect Claude, use Gemini directly. Custom AI workflow implementations for more sophisticated setups are scoped as a separate engagement.

**Automated Narrative Reporting** — A RAG pipeline built natively in BigQuery that queries your mart tables, retrieves semantically relevant data, and generates written performance summaries delivered to Slack or email on a schedule you define. Replaces the weekly reporting meeting where someone reads a dashboard aloud. No external AI infrastructure required — the entire pipeline runs inside BigQuery using native AI functions.

**What you get at the end of Tier 3:** Your marketing team self-serves answers instead of asking the data person. Your executives get a written summary every Monday morning that tells them what changed, why, and what to pay attention to. Your data infrastructure works for the business, not the other way around.

### Tier 4 — Attribution & Advanced Analytics

**Heading:** Tier 4: Attribution & Advanced Analytics
**Subheading:** Finally answering "what's actually working."

This tier is only available to clients who have completed Tiers 1 and 2 with Patterson Consulting. Not because of a commercial requirement — because the models are only as good as the data feeding them, and I need to know the data is right.

**Components (scoped independently based on readiness):**

**Multi-Touch Attribution Modeling** — Shapley value or position-based attribution models built in Dataform on your event data in BigQuery. Replaces platform-reported attribution with logic you own, can inspect, and can trust. Privacy-compliant by design — built on first-party data collected through your Tier 1 infrastructure.

**Geo-Lift Incrementality Testing** — The most rigorous, privacy-friendly method for measuring whether a channel is driving incremental revenue or just capturing existing demand. Uses synthetic control methodology (the same statistical framework used in econometrics and public policy research) to compare test and control markets. Doesn't depend on user-level tracking, cookies, or device IDs. The only method that directly measures causation rather than inferring it from correlation.

**Media Mix Modeling** — Bayesian media mix modeling using Google's open-source Meridian framework, running on BigQuery. Requires 2+ years of historical spend and outcome data. Answers "how should I allocate my budget across channels" with statistical rigor, scenario planning, and an AI-assisted interpretation layer that makes the outputs accessible to non-technical stakeholders.

**Measurement Strategy & Testing Roadmap** — Ongoing advisory on what to test next, which channels to validate, and how to build a culture of measurement within your marketing team. This is the retainer component — not maintaining infrastructure, but guiding the questions you ask of it.

**What you get at the end of Tier 4:** An honest answer to the hardest question in marketing. Not "what did the platform report" but "what actually happened when we spent this money." Attribution you own, methodology you can defend to your CFO, and a testing roadmap that gets smarter over time.

---

## Page: About

### Page Content

**Heading:** I'm Ian Patterson. I build measurement infrastructure for marketing teams.

I spent a decade working across marketing, data, and technology — starting in the hospitality industry, moving into social media and influencer marketing, then into full-stack engineering, and eventually leading data and technology as VP at Allied Global Marketing, a major entertainment marketing agency.

That non-linear path is the point. I've sat in the creative meetings and the engineering standups. I've presented attribution models to CMOs and debugged data layer implementations at midnight before a launch. I've built the dashboards that executives use to make budget decisions and the pipelines that feed them. Most consultants in this space come from one side — either the marketing strategy side or the data engineering side. I come from both, which means I can translate between the two in a way that's rare and genuinely useful.

In parallel with consulting, I run Tuna Melts My Heart — a major pet influencer brand built around Tuna, a Chiweenie (Chihuahua-Dachshund mix) with an exaggerated overbite and 2 million Instagram followers. It's a real business with multiple revenue streams — merchandise, brand partnerships, licensed content, and live events — and it serves as a live testing ground for everything I build. The 2025 and 2026 Tuna calendars were produced using AI-generated imagery from fine-tuned FLUX models — 5,000 units sold, substantial profit, on a creative production cost of $400. That's not a case study I wrote. That's a case study I lived.

I'm based in Atlanta and I work with clients across the US and UK.

### What I Believe (Subsection)

**Measurement infrastructure is not a project. It's a capability.** Most companies treat tracking and analytics as a one-time setup. Then the data drifts, the tracking breaks, and nobody notices until a budget decision goes wrong. I build systems that monitor themselves, document themselves, and get smarter over time.

**AI should be infrastructure, not an afterthought.** Every layer of the stack I build has AI-native capabilities — from automated campaign taxonomy to natural language reporting to semantic data enrichment. Not because AI is trendy, but because these functions are genuinely better when they're embedded in the data pipeline rather than bolted on after the fact.

**You should own your data and your methodology.** Platform-reported metrics serve the platform's interests. Black-box attribution tools serve the vendor's interests. Everything I build lives in your warehouse, runs on your infrastructure, and uses methodology you can inspect and understand. When the engagement ends, the system keeps running.

---

## Page: Contact

### Page Content

**Heading:** Let's talk about your measurement stack.

I work with e-commerce brands, SaaS companies, marketing agencies, and mobile app companies that know their measurement infrastructure needs work but don't have the in-house expertise to fix it.

If you're not sure where to start, that's fine. Most engagements begin with a conversation about what's broken, what's missing, and what you're trying to answer. From there, I'll scope the work and tell you honestly which tiers make sense for your situation — and which ones don't.

**Email:** ian@iampatterson.com

**What to expect:** I'll respond within 24 hours. If we're a good fit, we'll schedule a 30-minute call to discuss your current setup and goals. No proposals without a conversation first.

### Thank You Page (`/contact/thanks`)

**Heading:** Message sent.

Thanks for reaching out. I'll respond within 24 hours. If we're a good fit, we'll schedule a 30-minute call to discuss your current setup and goals.

[Back to home →]

*Note: This is the form submission conversion URL. Use `/contact/thanks` as the sGTM/GA4 conversion trigger for contact form completions.*

---

## Demo Pages

### Demo Landing / Overview Page

**Heading:** Three business models. One stack. See it all running live.

These aren't mockups. Each demo below is a fully functional front-end generating real events that flow through the same measurement infrastructure I build for clients — consent management, server-side GTM, BigQuery, Dataform transformations, AI-enriched data models, and live dashboards.

Interact with any demo, then flip the card to watch your own session data propagate through every layer of the stack in real time.

**The Tuna Shop** — E-commerce: product views, add to cart, checkout, purchase tracking. See how purchase events flow from click to warehouse to attribution model.

**Tuna Subscription** — Subscription model: trial signups, activations, renewals, churn. See how cohort analysis and LTV calculations are built on the same event infrastructure.

**Tuna Partnerships** — Lead generation: form submissions, lead qualification, funnel tracking. See how marketing-qualified leads are scored and attributed to acquisition channels.

Each demo runs on months of simulated data generated by a background service that mimics realistic traffic patterns, seasonal trends, and multi-channel campaign activity — including the kind of messy naming conventions that make real marketing data so painful to work with.

### Demo: The Tuna Shop (E-Commerce)

**Demo Introduction (visible before entering the shop experience):**

**Heading:** The Tuna Shop
**Subheading:** A fully instrumented e-commerce storefront.

Welcome to the Tuna Melts My Heart online shop. Browse Tuna-branded products, add items to your cart, and go through checkout — every interaction generates events that flow through the full measurement stack.

What you'll see when you flip the card:

- **Tier 1 in action:** Your consent choice propagating through the tracking layer. sGTM processing your add-to-cart and purchase events. Server-side delivery to GA4 and simulated ad platform APIs.
- **Tier 2 in action:** Your events landing in BigQuery raw tables, then transformed through Dataform into campaign performance and customer LTV marts. AI-classified campaign taxonomy cleaning up messy UTM parameters.
- **Tier 3 in action:** Dashboards showing revenue by channel, product performance, customer acquisition funnels — all built on the same data your session is contributing to.
- **Tier 4 in action:** Multi-touch attribution comparing Shapley value allocation against last-click, showing how different models tell different stories about which channels drive revenue.

**KPIs demonstrated:** Revenue, AOV, conversion rate by channel, ROAS by campaign, product-level attribution, customer acquisition cost.

**Shop content (product listings):**

- Tuna Plush Toy — $24.99 — "The original Tuna plush. Soft, judgmental, and ready for your couch."
- Tuna 2026 Calendar — $19.99 — "12 months of AI-generated Tuna art. Every image created with fine-tuned FLUX models."
- Tuna Enamel Pin Set — $14.99 — "Four pins. Four moods. All Tuna."
- Tuna Tote Bag — $29.99 — "Carry your groceries with the quiet confidence of a famous dog."
- Tuna Holiday Ornament — $12.99 — "For the tree that deserves better than generic baubles."
- Tuna Mug — $17.99 — "Start every morning with Tuna staring at you. As nature intended."

**Product detail page template content:**

Each product page includes: product image, product name, price, description, size/variant selector where applicable, add to cart button, and a "You might also like" section with two related products.

**Cart page:** Line items with quantity adjustment, subtotal, estimated shipping, order total, proceed to checkout button.

**Checkout flow:** Shipping information form (simulated — no real data collected), payment step (simulated — shows a "Complete Purchase" button that fires the purchase event chain without processing real payment), order confirmation page with order number and summary.

**Order confirmation message:** "Thanks for your (simulated) order! This purchase event just fired through sGTM, landed in BigQuery, and updated the dashboards. Flip the card to see exactly what happened."

### Demo: Tuna Subscription (Subscription Model)

**Demo Introduction:**

**Heading:** Tuna Subscription
**Subheading:** A subscription product from signup to retention.

The Tuna Melts My Heart monthly subscription box — a curated selection of Tuna-branded merchandise delivered to your door. This demo walks through the full subscription lifecycle: plan selection, trial signup, activation, and the ongoing retention events that power cohort analysis.

What you'll see when you flip the card:

- **Tier 1 in action:** Signup and activation events processed server-side. Consent state determining which platforms receive trial conversion data.
- **Tier 2 in action:** Subscription events transformed into cohort tables. Trial-to-paid conversion rates modeled by acquisition channel. LTV calculations that update as simulated subscribers renew or churn.
- **Tier 3 in action:** Cohort retention curves, MRR trending, churn analysis by acquisition source — the dashboards a subscription business lives and dies by.
- **Tier 4 in action:** Channel attribution showing which acquisition sources produce subscribers with the highest LTV, not just the most signups.

**KPIs demonstrated:** Trial-to-paid conversion rate, monthly churn rate, LTV by acquisition channel, MRR/ARR, cohort retention curves, payback period.

**Landing page content:**

**Heading:** The Tuna Box
**Subheading:** Monthly Tuna-branded joy, delivered.

Every month, a curated box of Tuna Melts My Heart exclusives — apparel, accessories, art prints, and surprises you can't get anywhere else. Cancel anytime.

**Plan options:**

- **The Pup** — $19.99/month — 2-3 items per box. Perfect for the casual Tuna fan.
- **The Good Boy** — $34.99/month — 4-5 items per box including one exclusive item. The most popular plan.
- **The Big Tuna** — $49.99/month — 6-7 items per box, early access to new products, and a quarterly limited edition item. For the committed.

**Trial offer:** First box 50% off with any plan. No commitment — cancel before your second box ships and pay nothing more.

**Signup form:** Name, email, plan selection, shipping address (simulated), payment (simulated). "Start My Trial" button fires the trial_signup event.

**Post-signup confirmation:** "Your trial is active! In a real subscription, you'd receive your first box within 5-7 days. In this demo, we've just fired a trial_signup event through the full stack. Flip the card to see your signup flow through consent, sGTM, BigQuery, and into the cohort models."

**Account dashboard (simulated post-signup view):**

- Subscription status: Active (Trial)
- Current plan: [selected plan]
- Next box ships: [simulated date]
- Subscription history: Trial started [date]
- Manage subscription: Upgrade / Downgrade / Cancel buttons (each fires the corresponding event)

### Demo: Tuna Partnerships (Lead Generation)

**Demo Introduction:**

**Heading:** Tuna Partnerships
**Subheading:** A lead generation landing page with full funnel tracking.

Tuna Melts My Heart has 2.5 million Instagram followers and a proven track record with brand partnerships. This demo represents the kind of landing page a brand or agency would use to generate and qualify partnership inquiries — with every form interaction tracked through the measurement stack.

What you'll see when you flip the card:

- **Tier 1 in action:** Form field interactions, form start, and form submission events captured server-side. Lead data flowing into BigQuery with consent-appropriate handling.
- **Tier 2 in action:** Lead qualification logic applied via AI functions in Dataform. Leads automatically scored and categorized by partnership type, company size, and estimated deal value.
- **Tier 3 in action:** Lead funnel dashboards showing visits → form starts → submissions → qualified leads. Cost per qualified lead by acquisition channel. Conversion timeline from first touch to closed deal.
- **Tier 4 in action:** Attribution showing which channels produce the highest-quality leads (not just the most leads), measured by downstream conversion to closed partnerships.

**KPIs demonstrated:** Form start rate, form completion rate, lead qualification rate, cost per lead, cost per qualified lead by channel, lead-to-meeting conversion rate, pipeline value.

**Landing page content:**

**Heading:** Partner with Tuna Melts My Heart
**Subheading:** 2.5 million followers. 5,000 calendars sold. Real engagement, real conversions.

Tuna Melts My Heart isn't just a social media account — it's a consumer brand with a proven audience and a track record of turning followers into buyers. We work with brands that want to reach an engaged, passionate community of pet lovers and lifestyle consumers.

**Partnership highlights:**

- 2.5M Instagram followers with above-average engagement rates
- 5,000+ units of AI-generated calendars sold annually
- Proven conversion from social content to e-commerce purchases
- Flexible partnership formats: sponsored content, product collaborations, event sponsorships, licensing
- Full creative production capability including AI-generated custom imagery using fine-tuned models

**Previous partners section:** [Placeholder for partner logos and brief case descriptions]

**What we offer:**

- **Sponsored Content** — Authentic Tuna-branded content featuring your product, distributed across our social channels.
- **Product Collaboration** — Co-branded merchandise designed, produced, and sold through our e-commerce platform.
- **Event Sponsorship** — Presence at our live events, including the annual Holiday Pawty.
- **Licensing** — License the Tuna brand and imagery for your own products and campaigns.

**Inquiry form:**

- Your name
- Company name
- Email
- Partnership type interested in (multi-select: Sponsored Content / Product Collaboration / Event Sponsorship / Licensing / Not sure yet)
- Estimated budget range (dropdown: Under $5k / $5k-$15k / $15k-$50k / $50k+ / Prefer to discuss)
- Tell us about your brand and what you're looking for (textarea)
- Submit button: "Start the Conversation"

Each form field interaction fires a form_field_focus event. Clicking into the form fires a form_start event. Submission fires a form_complete event with all field values.

**Post-submission confirmation:** "Thanks for your inquiry! In a real implementation, this lead just entered a qualification pipeline — AI-scored, categorized by partnership type, and attributed to the channel that brought you here. Flip the card to see the full journey from your first page view to qualified lead."

---

## Flip-the-Card Contextual Content

### Consulting Pages — Overlay Annotations

When a visitor activates the flip overlay on any consulting page, brief annotations explain what's happening at each instrumentation point:

**Consent banner annotation:** "Your consent choice is being processed. [Accept/Reject] status is passed to sGTM, which determines which tags fire and which platforms receive your data. Change your preference and watch the active tags update in real time."

**Page view annotation:** "This page view was captured client-side, sent to your sGTM container at [custom domain], and routed to GA4 and BigQuery. The raw event is now in the warehouse."

**CTA click annotation:** "That click just fired a custom event through the data layer. sGTM processed it and delivered it to [list of active destinations based on consent state]."

**Scroll depth annotation:** "Scroll depth milestones (25%, 50%, 75%, 100%) are tracked via sGTM. This tells us how much of the page you actually engaged with, not just that you landed on it."

### Demo Pages — Pipeline Narrative

When a visitor activates the flip overlay on a demo page, the narrative flow explains the full pipeline for each event type:

**E-commerce event narrative (add to cart example):**
"You just added [product name] to your cart. Here's what happened:
→ A data layer push fired with the product name, price, quantity, and your session ID.
→ Your sGTM container received the event at [custom domain].
→ Based on your consent state, the event was delivered to: GA4, Meta Conversions API (simulated), Google Ads Enhanced Conversions (simulated).
→ Simultaneously, the raw event was streamed to BigQuery.
→ In the staging layer, Dataform will flatten this event and extract the product parameters.
→ In the mart layer, this event contributes to mart_campaign_performance and mart_customer_ltv.
→ The campaign that brought you here was classified as [AI-classified taxonomy category] by our automated taxonomy."

**Subscription event narrative (trial signup example):**
"You just started a trial on the [plan name] plan. Here's what happened:
→ A trial_signup event fired with your plan selection, simulated email, and acquisition source.
→ sGTM processed the conversion event and delivered it server-side to the configured platforms.
→ In BigQuery, this signup enters the raw subscription events table.
→ Dataform assigns you to a cohort based on your signup date and acquisition channel.
→ Your trial-to-paid conversion will be tracked over time, contributing to the cohort retention curves in the dashboards.
→ The channel that acquired you is now being compared against every other channel for LTV prediction."

**Lead gen event narrative (form submission example):**
"You just submitted a partnership inquiry. Here's what happened:
→ A form_complete event fired with your form responses (partnership type, budget range, company info).
→ sGTM delivered the lead event to BigQuery and the configured platforms.
→ In BigQuery, AI.CLASSIFY scored your lead based on the information provided — partnership type, budget range, and company size.
→ Your lead was categorized as [qualification tier] and added to mart_lead_funnel.
→ The channel that brought you here now has one more data point in the cost-per-qualified-lead calculation."

---

## Content Principles

**Voice:** Direct, knowledgeable, confident without arrogance. First person. Short sentences where possible. Technical accuracy over marketing polish. No buzzwords ("synergy," "leverage," "unlock," "empower"). No exclamation marks.

**Audience awareness:** Every page should be legible to a marketing director who doesn't know what BigQuery is, while simultaneously being credible to a data engineer who wants to verify the technical claims. The trick is plain language for concepts and precision for specifics.

**Proof over claims:** Never say "we deliver great results." Show the result. The flip-the-card mechanism is the embodiment of this principle — instead of claiming the stack works, you show it working.

**Respect for the reader's time:** No filler paragraphs. No "in today's rapidly evolving digital landscape." Every sentence should either inform or persuade. If it does neither, cut it.

**AI positioning:** AI capabilities are described as built into the infrastructure, never as a separate selling point. The language is "the transformation layer uses AI to classify your campaigns" not "we leverage cutting-edge AI technology." The capability is the point. The technology is the implementation detail.

**Tuna brand voice (demo content only):** Warm, slightly irreverent, self-aware. Tuna is a Chiweenie with an overbite who became an internet celebrity — the brand doesn't take itself too seriously. Product descriptions are playful. The contrast between the playful demo front-ends and the sophisticated back-end instrumentation is intentional and reinforces the message: serious infrastructure, applied to any business.