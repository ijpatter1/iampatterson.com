# Patterson Consulting, Style Guide

> **Status: CLEAN SLATE (as of session 018).** The color palette sections below were tried and rejected during design iteration. The site currently uses white backgrounds, black text, and no accent color. Fonts (Lora, Plus Jakarta Sans, JetBrains Mono) are finalized. The next step is choosing a single accent color. The Voice & Tone, Typography, Spacing, and Component Patterns sections remain valid. Color sections are preserved as historical context for what was tried.

## Design Intent

This is the portfolio site for Patterson Consulting, a MarTech consulting practice that also runs a 2.5M-follower pet brand and produced AI-generated calendars that made $45k. The site itself is proof of craft: the measurement infrastructure running underneath it is the product, and the visual layer should signal that the person who built that backend also cares about the frontend.

The aesthetic communicates: technically deep, creatively fluent, has great taste. The tone is **editorial confidence meets technical precision**. Not cold, not corporate, not startup-playful. Warm, assured, considered.

---

## Voice & Tone

The site's name is **iampatterson.com**. It's a bold statement, but delivered with a smirk, confident because the work backs it up, not because it's trying to impress you. The voice throughout the site should reflect this: direct, knowledgeable, occasionally irreverent, never pompous.

### Key characteristics:

**Confident but not self-important.** State what you do and what it delivers. Don't hedge, don't qualify, don't soften with "I believe" or "I think." But also don't puff, no "world-class" or "cutting-edge" or "best-in-class." The work is the claim. The infrastructure running underneath this page is the proof.

**Technical precision without jargon walls.** Explain sGTM, Dataform, Shapley value attribution, but explain them in terms of what they *do for the client*, not what they *are* technically. A CMO should be able to read every page and understand the value. A data engineer should be able to read every page and verify the depth.

**Irreverent where it earns it.** The Tuna Melts My Heart brand is playful by nature, an overbite Chiweenie with 2.5M followers is inherently funny. Lean into that contrast: serious infrastructure, applied to a dog brand. The demo products ("Start every morning with Tuna staring at you. As nature intended.") can be warm and self-aware. The consulting copy stays sharp and direct.

**Self-deprecating in small doses, never self-undermining.** The non-linear career path (hospitality → influencer marketing → engineering → VP of Data → independent consultant) is a strength, not something to apologize for. Acknowledge it matter-of-factly. "I've sat in the creative meetings and the engineering standups" is the right register. Never defensive, never over-explaining why the path matters.

**Short sentences where possible.** Don't write a paragraph when a line will do. "That's what I build." is stronger than any elaboration of it. Let the work breathe.

---

## Color Palette

### Primary, Sage Green

The brand's dominant color. Used for CTAs, active states, key accents, and the primary brand signal. Earthy, mature, distinctive, immediately sets this site apart from the blue/navy/black palette every other consultant uses.

| Token | Hex | Usage |
|---|---|---|
| `sage-900` | `#4A5640` | Nav text, headings on light backgrounds, dark UI elements |
| `sage-700` | `#6B7F5E` | Primary brand color, CTA buttons, links |
| `sage-500` | `#8FA680` | Hover states, secondary accents, active indicators |
| `sage-400` | `#A8BF9A` | Borders on dark backgrounds, muted accents |
| `sage-200` | `#C8D5C0` | Subtle background fills, card borders |
| `sage-100` | `#E8EFE4` | Light section backgrounds, wash |

### Secondary, Dusty Plum

The complementary color. Used for depth, visual rhythm, hover states, and secondary UI elements. Dusty and desaturated, not bright or saturated purple.

| Token | Hex | Usage |
|---|---|---|
| `plum-900` | `#3D2F43` | Deep accent, dark mode surfaces |
| `plum-700` | `#5C4B63` | Secondary dark, section backgrounds |
| `plum-500` | `#8B7193` | Secondary brand color, tags, badges |
| `plum-400` | `#A891B0` | Lighter accents, highlights |
| `plum-200` | `#D0C3D8` | Subtle borders, light accents |
| `plum-100` | `#EDE7F1` | Light wash backgrounds |

### Neutral, Warm

All text and structural elements use warm neutrals. Never pure black (`#000`), never cool grey. The warm undertone keeps text feeling approachable rather than stark.

| Token | Hex | Usage |
|---|---|---|
| `neutral-900` | `#2B2424` | Body text, primary headings, the "near-black" |
| `neutral-700` | `#5C4A3D` | Warm dark accent, strong secondary text |
| `neutral-500` | `#8C7B6B` | Secondary body text, captions, timestamps |
| `neutral-400` | `#B5A899` | Placeholder text, disabled states |
| `neutral-200` | `#DDD6CC` | Borders, dividers, subtle UI lines |
| `neutral-100` | `#F5F2EE` | Page background, cream, not white |

### Demo Accent Colors

Each demo gets a distinct accent color that carries through its spotlight card on the homepage and all pages within the demo. These accents overlay the base palette, not replace it.

| Demo | Accent | Hex | Character |
|---|---|---|---|
| The Tuna Shop (E-Commerce) | Amber/Terracotta | `#C4703A` | Warm, playful, product-forward |
| Tuna Subscription Box | Deep Plum | `#5C4B63` | Premium, curated, exclusive |
| Tuna Partnerships (Lead Gen) | Sage | `#4A5640` | Professional, editorial, trust |

### Usage Rules

- **Page background** is always `neutral-100` (`#F5F2EE`), not white. This single change removes the template feel immediately.
- **Text** is always from the warm neutral scale. `neutral-900` for body, `neutral-500` for secondary, `neutral-400` for muted/disabled.
- **Sage green** is the primary action color, buttons, links, active nav states, focus rings.
- **Plum** is never used for primary actions. It's for depth, rhythm, and visual contrast, section backgrounds, hover reveals, badges, secondary elements.
- **Never use** the Tailwind default `neutral-*` (cool grey), `gray-*`, or `slate-*` scales. Replace all instances with the warm neutral scale above.
- Ensure sufficient contrast ratios for accessibility (WCAG AA minimum). `neutral-900` on `neutral-100` passes easily. `sage-700` on `neutral-100` passes. Test `neutral-500` on `neutral-100`, it may need to go to `neutral-700` for small text.

---

## Typography

### Font Stack

| Role | Font | Source | Weights |
|---|---|---|---|
| Display | **Instrument Serif** | Google Fonts | Regular (400), Italic |
| Body | **Plus Jakarta Sans** | Google Fonts | 400, 500, 600, 700 |
| Mono | **JetBrains Mono** | Google Fonts | 400, 500 |

Load via `next/font/google` for automatic optimization and no layout shift.

### Why These Fonts

**Instrument Serif** is the taste signal. Every other MarTech consultant's site uses a geometric sans for everything. A serif display font immediately says "this person thinks about design." It's editorial, warm, confident, the typographic equivalent of a well-cut suit at a technical meeting. Use it for hero text, section headings, and anywhere you want the visitor to slow down and read.

**Plus Jakarta Sans** is the clarity signal. It's a clean geometric sans with slightly rounded terminals that give it warmth Inter and DM Sans lack. Readable at every size, professional without being sterile. It does the work of body text without drawing attention to itself, which is exactly what body text should do.

**JetBrains Mono** is the credibility signal. It says "I write code" every time it appears. Use it for event names in the pipeline overlay, data layer parameters, technical annotations, and anywhere raw data appears. It grounds the editorial confidence of the serif in technical reality.

### Type Scale

Use a scale that breathes. The current site crams too much text into too-similar sizes.

| Element | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Hero heading | Instrument Serif | `text-5xl` / `text-6xl` | 400 | `tracking-tight` |
| Section heading | Instrument Serif | `text-3xl` / `text-4xl` | 400 | `tracking-tight` |
| Subsection heading | Plus Jakarta Sans | `text-xl` / `text-2xl` | 600 | Normal |
| Body | Plus Jakarta Sans | `text-base` | 400 | Normal |
| Small / caption | Plus Jakarta Sans | `text-sm` | 400 | Normal |
| Label / overline | Plus Jakarta Sans | `text-xs` | 600 | `tracking-wider uppercase` |
| Code / event name | JetBrains Mono | `text-sm` | 400 | Normal |
| KPI / metric | JetBrains Mono | `text-2xl` | 500 | `tracking-tight` |

### Typography Rules

- **Headings** are Instrument Serif, always. Even small section headings. The consistency of the serif for all headings creates a strong rhythm.
- **Body text** never exceeds `max-w-2xl` (~42em). Long lines kill readability.
- **Don't mix** serif and sans in the same line. Instrument Serif is for headings. Plus Jakarta Sans is for everything else. The contrast between them is the point, don't dilute it.
- **Monospace** appears only in technical contexts: event names, parameter keys, pipeline IDs, code snippets, dashboard metrics. Never for body text, never for headings.
- **Italic** Instrument Serif is available for pull quotes and emphasis in editorial contexts (About page, "What I Believe" principles).

---

## Spacing & Layout

### Base Rhythm

Use `4px` increments (Tailwind's default `p-1` = `4px`). Generous whitespace is essential, the current site feels cramped because sections run into each other.

- **Section padding**: `py-24` minimum on desktop, `py-16` on mobile. Each section should feel like its own room.
- **Content max-width**: `max-w-5xl` for full-width sections, `max-w-2xl` for prose-heavy content.
- **Section gaps**: Use either a visible divider (a thin `neutral-200` line) or a background color change between sections. Never just stack sections with identical backgrounds and no visual break.

### Layout Principles

- **Full-viewport sections** on the homepage. Each section occupies at least `min-h-screen` and presents one idea. The visitor scrolls through a sequence of scenes, not a continuous document.
- **Asymmetric layouts** where content allows it. Not everything needs to be centered in a `max-w-3xl` column. Consider split layouts (40/60, text left / visual right), offset headings, pull quotes that break the column.
- **Negative space is a design element.** Don't fill every pixel. A heading with `mt-20 mb-12` and nothing else on screen is more powerful than a heading crammed above a paragraph.

---

## Component Patterns

### Buttons

- **Primary CTA**: `sage-700` background, `neutral-100` text, rounded (`rounded-lg`), generous padding (`px-8 py-4`). Hover: `sage-900`. Transition on background-color.
- **Secondary CTA**: `neutral-100` background, `sage-700` text, `sage-200` border. Hover: `sage-100` background.
- **Text link / tertiary**: `sage-700` text, underline offset (`underline-offset-4`), hover: `sage-900`.
- No ghost buttons (transparent background + colored border). They read as disabled.

### Cards

- Background: `white` (a step up from the `neutral-100` page background, this creates a subtle lift effect).
- Border: `neutral-200`, `rounded-xl`.
- Shadow: subtle (`shadow-sm`), not dramatic. On hover: `shadow-md` + `border-neutral-300`. The lift should feel physical, not glowy.
- Demo spotlight cards break this pattern, they get their demo accent color as a background or gradient, full-width treatment, and more dramatic hover.

### Overline Labels

Used above section headings to categorize content (e.g., "Tier 1", "E-Commerce Demo", "About").

- Plus Jakarta Sans, `text-xs`, `font-semibold`, `uppercase`, `tracking-wider`
- Color: `sage-700` or `plum-500` depending on section
- Always followed by an Instrument Serif heading

### Transitions & Motion

- All interactive elements: `transition-all duration-200 ease-out`
- Page transitions: fade or slide (implement with Framer Motion's `AnimatePresence`)
- Scroll reveals: fade-up with stagger for multi-element sections
- `prefers-reduced-motion: reduce`, disable all animation, show all content immediately

---

## Dark Sections

Some sections use dark backgrounds for contrast and rhythm (the current hero is already dark). When a section has a dark background:

- Background: `sage-900` or `plum-900` (not pure black, not `neutral-900`)
- Heading text: `neutral-100`
- Body text: `neutral-400` (the warm tone prevents text from looking washed out)
- Accent elements: `sage-400` or `plum-400` (lighter variants maintain visibility)
- Borders: `white/10` or `white/15` opacity

---

## What This Is NOT

- **Not corporate.** No blue. No navy. No "enterprise SaaS" feel.
- **Not startup-playful.** No rounded blobs, no pastel illustrations, no emoji-as-design.
- **Not template.** If it looks like it could have come from a Tailwind UI component, it needs more personality.
- **Not dark mode by default.** The cream background is the brand. Dark sections are used for contrast, not as the default.
- **Not maximalist.** The inspiration sites (Daniel Sun, Perry Wang, Marco) use motion and layout inventively, but they don't overwhelm. The goal is considered confidence, not "look how many animations I know."

---

## Implementation Notes for the Coding Agent

### Tailwind Config

Replace the existing `tailwind.config.ts` color and font definitions with the palette above. Use the exact token names (`sage-900`, `plum-500`, `neutral-100`, etc.) so every component references the system.

### next/font Setup

```tsx
import { Instrument_Serif, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';

const instrumentSerif = Instrument_Serif({
  weight: ['400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-display',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});
```

Apply as CSS variables on `<html>`, then reference in Tailwind config:

```ts
fontFamily: {
  display: ['var(--font-display)', 'Georgia', 'serif'],
  body: ['var(--font-body)', 'system-ui', 'sans-serif'],
  mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
},
```

### Event Tracking Preservation

Every component that currently calls `trackClickCta`, `trackClickNav`, `trackPageView`, `trackScrollDepth`, `trackFormStart`, `trackFormFieldFocus`, `trackFormSubmit`, or any demo tracking function must preserve those calls in the redesigned version. The visual layer changes. The data layer does not. Run `npm test` after every component replacement to verify no tracking regressions.