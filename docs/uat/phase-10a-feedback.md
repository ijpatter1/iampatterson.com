# Feedback

## Phase 10 Polish Feedback r1

Language - whole site copy needs to be analysed against my voice and corrected where it has drifted. For example, in the hero section, "Most consultants describe what they build" is the kind of industry-generalization-as-filler the voice guide warns against. This is a big lift that warrants a whole dedicated session.

Data Generator campaign labels include "Cat Content". This is from an LLM hallunication that Tuna is a cat, not a chiweenie. The data generator needs to be scrutinised and fixed, and existing misclassified data needs to be scrubbed from BigQuery.
This element,
```
<p class="p-meta max-w-[42ch] font-mono text-[12px] leading-[1.5] text-ink-2 md:pb-3 md:leading-[1.6]">Every scroll, click, and page view on this site flows through the same measurement pipeline I deploy for clients.<br><br>The events aren't simulated. The warehouse is real. The dashboards are running.</p>
```
needs to match the font and size of the rest of the body copy. The positioning and spacing looks awkward too on desktop.

Explore the demos CTA needs to be singular now

In the Pipeline section, make the CTA button persimmon even without the effect

In the Tiers section, each tier should like to their specific page section. Right now they all go to /services instead of /services#tier-02, /services#tier-03, etc.

Cut this section: "Evidence · What the infrastructure has done"

In the "About" page, this paragraph feels random: "The 2025 and 2026 Tuna calendars were produced using AI-generated imagery from fine-tuned FLUX models. 5,000 units sold, substantial profit, on a creative production cost of $400. That's not a case study I wrote. That's a case study I lived." I want to mention the project but it needs some bridging from "Measurement Infrastructure" to "AI Assisted Production". It could be as simple as "in addition to martech expertise, I specialise in [x,y,z]"

in the ecommerce demo, add a "back to homepage link" in the "this is a demo · nothing ships from here" bar.

Add images to shop

The overlay Overview page might benefit from some exposition or directive, like the Timeline and Consent tabs do. Speaking of the consent tab, maybe we should add a directive to try withdrawing or changing consent using the consent widget in the bottom left corner.

In all the overlay tab, were applicable, add red and green accents for "accepted" and "denied" states and text to add more variety