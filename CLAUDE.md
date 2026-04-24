# iampatterson.com

## Project Identity

This is the consulting website for Patterson Consulting **and** a live, interactive demonstration of a full measurement infrastructure stack. Visitors experience a polished consulting site with a single embedded ecommerce demo environment (the Tuna Shop). At any point, they can activate the Session overlay via the SessionPulse affordance to see the stack running beneath their own session in real time. The site itself is the portfolio. Subscription and lead gen demos were removed in Phase 9E pending rebuild to the native-reveal pattern established by Phase 9F; see `docs/UX_PIVOT_SPEC.md` §4 for the scope rationale and reintroduction criteria.

## Tech Stack

- **Framework:** Next.js 16+ (App Router), React 19, TypeScript (strict mode), Tailwind CSS. Node.js ≥20.9.0. ESLint 9 flat config.
- **Instrumentation:** Cookiebot CMP → client-side GTM → self-hosted sGTM on Cloud Run → GA4, BigQuery, simulated Meta CAPI / Google Ads Enhanced Conversions. Core Web Vitals via the `web-vitals@^5` library emit a `web_vital` event to the same data layer (Phase 10b D1a).
- **Real-Time Pipeline:** sGTM → Pub/Sub → Cloud Run WebSocket/SSE service → browser (scoped by session ID)
- **Data:** BigQuery (raw → staging → marts via Dataform), background data generator on Cloud Run
- **BI:** Self-hosted Metabase on Cloud Run (IAP-gated at `bi.iampatterson.com`), dashboards-as-code via YAML + `apply.sh`. Signed-JWT (`jsonwebtoken`) static embeds on the ecommerce confirmation page.
- **AI:** BigQuery managed AI functions (AI.CLASSIFY, AI.IF), RAG pipeline for narrative reporting
- **Hosting:** Vercel (Next.js frontend), GCP Cloud Run (backend services, WebSocket, data generator, sGTM, Metabase)
- **Package Manager:** npm
- **Testing:** Jest + React Testing Library (components), Playwright (E2E), custom integration tests for event pipeline

## Current Phase

**Phase 10, Polish, Performance & Launch Prep — IN PROGRESS, restructured into four sub-phases 2026-04-23.** UAT r1 (2026-04-23) surfaced ~12 content/polish items on top of the original launch-prep scope; two were substantial enough to warrant dedicated sessions. The sub-phase structure follows the 9A-redesign / 9B-infra / 10a convention.

- **10a Framework Currency** ✅ shipped 2026-04-23 as PR #40 (`1a00490`). Next.js 14→16, React 18→19, Node 20.9+, ESLint 9 flat, `after()` migration, React-Compiler preflight (31 `eslint-plugin-react-hooks@7` violations cleared via 3 shared hooks — `useClientMount`, `usePrefersReducedMotion`, `useSessionId` — plus ref→state conversions, lazy init patterns, justified disables). Test suite 1164 → 1187.

- **10b Core Web Vitals & Performance** 🔄 on branch `phase/10b-core-web-vitals` cut from `main@8e902c5`. D1a ✅ CWV measurement foundation (`6df76a7`). D1b ✅ Lighthouse capture (`36e642d` + `83b4157`) via `scripts/capture-cwv-baseline.sh`: **desktop Perf 99-100 across all three dynamic routes, LCP 0.7-0.8s, hero h1 is the LCP element**; mobile-throttled Perf 80/0/75 on default Lighthouse mobile preset (Slow-4G + 4× CPU emulation). D1c ✅ investigation complete with the original REQUIREMENTS target revised 2026-04-24 during the Pass-1 evaluator fix-pack (`c2de9f6` + `83b4157` + fix-pack commits): desktop targets met on branch; mobile targets deferred pending (a) a Vercel-preview Lighthouse loop that can measure real-TLS savings preconnect provides, or (b) the Phase 11 D9 sGTM trigger + GA4 tag that wires `web_vital` through to `iampatterson_raw.events_raw` so field-data queries become possible. No field data flows today, the reporter emits to `window.dataLayer` only. Carry-forward levers enumerated in the baseline doc. Lighthouse capture script is a developer utility, not a CI gate. D5 ✅ WebSocket connection reliability — pre-existing exponential backoff + max-retries + native dataLayer fallback via `useLiveEvents`, extended with ±20% jitter + `online` auto-recovery (the Pass-0 `retry()` export was reverted in the fix-pack as dead API). D6 ✅ Overlay render perf — `EventTimeline` rows extracted as `React.memo`-wrapped sub-component with stable `useCallback` `onSelect`; 100-event stress test + DOM-node reuse test as regression pins. **Phase 10b complete.** Next: 10c (Voice & Data Honesty) on a new branch cut from main after 10b merges, per the approved sub-phase sequencing.

- **10c Voice & Data Honesty** 🔄 **dev-complete pending UAT + PR + merge.** D1 + D2 + ops follow-ups shipped 2026-04-24 on branch `phase/10c-voice-and-data-honesty` (merged to main as PR #44 `b7c8be2`). D3 + D4 + D5 voice audit shipped 2026-04-24 on branch `phase/10c-voice-audit` (cut from main@99f76d1; 4 commits `ea28839`, `b812092`, `9768d19`, `3960d9e`; ready for UAT + PR). D3 flag pass surfaced 19 items across `/`, `/services`, `/about`, `/contact`, `/demo/ecommerce/*`, and the overlay; D4 executed the rewrites with R1 + R2 + evaluator fix-pack iteration (hero invisible→visible arc with "your session is the portfolio" visitor-scoped thesis; pipeline-section body cut in favor of "The pipeline, running." H2; tier 1/2/3/4 ledes reworked; About bio tail + Tuna sidebar + belief card 1 rewrites; About closer section added with `about_closer` CtaLocation added to schema; Contact industries line broadened; Send/Message/What-I-Believe sentence-case fixes; services-teaser ".," artifact cleaned across all 4 tier rows; dead p-meta CSS selectors removed). D5 extended `docs/voice-and-style-guide.md` with 4 patterns (agency-vocab expansion, AI-assisted-X stuffing tail, self-grading prose as significance-puffing subtype, cross-surface echoes + generalization tics across surfaces). Test suite 1201 → 1201 (pins walked, no new tests). Session handoff at `docs/sessions/session-2026-04-24-003.md`.

- **10d Launch Prep** ⬜ — punch list: mobile testing, error handling, site analytics remainder, SEO, security review, load testing, anonymous_id cookie, plus UAT r1 UX polish bundle (~~hero `p-meta` typography~~ closed by 10c D4 + evaluator fix-pack, tier deep-links, singular demo CTA, persimmon pipeline CTA, cut Evidence section, shop images at `docs/shop_images/*.webp`, demo-bar back-link, Overview + Consent directives, red-green accepted/denied accents). **R3 residuals carried from 10c:** (1) "See your session" button-label workshop — R2 asked for alternatives; needs user input against the Final CTA headline coupling. (2) Services hero pre-existing comma splice at `src/app/services/page.tsx:82-87` — not introduced by 10c, belongs to a wider voice pass.

Sequencing: finish 10b first (perf measurement groundwork shouldn't churn under 10c/10d surface edits), then 10c, then 10d.

**Prior phase state:** Phase 9B is dev-complete on branch `phase/9b-ecommerce-tiers-2-3` (673 tests passing, Pass 5 dual-eval PASS). 9B is the baseline the 9E branch will be cut from. Phase 9A-redesign merged to main (`d8ae8f2`).

See `docs/REQUIREMENTS.md` for the full development plan (Phases 1-8, 9A / 9A-redesign / 9B / 9B-infra / 9E / 9F, 10-11; 9C and 9D cancelled).
See `docs/ARCHITECTURE.md` for technical architecture details.
See `docs/PHASE_STATUS.md` for current completion state.

Work on the current phase only. Do not implement features from future phases. If you encounter a dependency on a future phase, note it in your session handoff and move on.

Do not modify sections of this file other than "Current Phase" unless explicitly asked to.

## Directory Structure

```
iampatterson.com/
├── CLAUDE.md                    # This file, project context for Claude Code
├── docs/
│   ├── REQUIREMENTS.md          # Full development plan (11 numbered phases + 9A-redesign / 9B-infra / 9E / 9F sub-phases)
│   ├── ARCHITECTURE.md          # Technical architecture
│   ├── PHASE_STATUS.md          # Living phase completion tracker
│   └── sessions/               # Session handoff artifacts
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components
│   ├── lib/                    # Shared utilities, types, constants
│   ├── hooks/                  # Custom React hooks
│   └── styles/                 # Global styles, Tailwind config
├── tests/
│   ├── unit/                   # Jest unit tests
│   ├── integration/            # Integration tests (event pipeline, data layer)
│   └── e2e/                    # Playwright E2E tests
├── public/                     # Static assets
├── .claude/                    # Claude Code configuration
│   ├── settings.json
│   ├── agents/
│   ├── commands/
│   └── skills/
└── infrastructure/             # IaC, Cloud Run configs, Dataform
```

## Testing

### First, Run the Tests

At the start of every session, before doing anything else, run:

```
npm test
```

This anchors you in the current state of the codebase. It tells you how many tests exist, whether anything is broken, and puts you in a testing mindset for the session.

### Red/Green TDD

Use red/green TDD for every feature:

1. **Write the test first**, define what the feature should do
2. **Run the test and watch it fail** (red), confirm the test is actually testing something
3. **Implement the minimum code to make it pass** (green)
4. **Refactor** if needed, re-running tests to confirm nothing breaks

This is non-negotiable. Every new feature, component, utility function, API route, and event handler gets a test written before the implementation.

### What to Test

- **Components:** Render correctly, handle props, respond to user interaction, display correct states (loading, error, empty, populated)
- **Event pipeline:** Data layer pushes contain correct event names and parameters. Events fire on the expected user interactions. Event schemas match the specification
- **API routes / server functions:** Return correct responses, handle errors gracefully, validate inputs
- **Utilities and hooks:** Pure logic tests, edge cases, error conditions
- **E2E (Playwright):** Critical user flows across pages. Consent banner interaction. Demo navigation. Flip-the-card overlay activation

### Test Commands

```bash
npm test                    # Run all Jest tests
npm test -- --watch         # Watch mode during development
npm test -- --coverage      # Coverage report
npx playwright test         # E2E tests (when Playwright is configured)
```

## Coding Standards

### TypeScript

- **Strict mode always.** No `any` types. No `@ts-ignore`. If you need to work around a type issue, create a proper type or use a type assertion with a comment explaining why.
- Prefer `interface` for object shapes, `type` for unions/intersections.
- Export types from the module that defines them. Import types with `import type` where possible.
- Use descriptive names. `EventPayload`, not `EP`. `SessionContext`, not `Ctx`.

### React / Next.js

- Functional components only. Use hooks for state and side effects.
- Server Components by default in the App Router. Add `'use client'` only when the component needs browser APIs, state, or event handlers.
- Colocate component-specific types, tests, and styles with the component when practical.
- Keep components focused. If a component exceeds ~150 lines, consider splitting it.

### Tailwind CSS

- Use Tailwind utility classes for all styling. No inline `style` attributes.
- Extract repeated patterns into Tailwind `@apply` compositions in the global stylesheet or into wrapper components.
- Follow the project's design system (defined during Phase 1 scaffolding).

### Data Layer / Events

- Every data layer push must conform to the event schema defined in `src/lib/events/schema.ts`.
- Event names use snake_case: `page_view`, `add_to_cart`, `form_submit`.
- Every event includes: `event_name`, `timestamp`, `session_id`, `page_path`, and event-specific parameters.
- Never push raw user input into the data layer without sanitization.

### Error Handling

- All async operations must have error handling. No unhandled promise rejections.
- User-facing errors show a meaningful message. Technical details go to the console / error reporting.
- API routes return appropriate HTTP status codes and structured error responses.

### Imports

- Use path aliases (`@/components`, `@/lib`, `@/hooks`) configured in `tsconfig.json`.
- Group imports: React/Next → third-party → local modules → types. Separate groups with a blank line.

## Git Conventions

### Commit Frequency

Commit after each completed feature or meaningful unit of work within a session. Small, frequent commits with descriptive messages. Each commit should leave the codebase in a working state (tests pass).

### Commit Messages

Use conventional commits format:

```
feat(component): add consent banner with Cookiebot integration
fix(pipeline): correct session ID extraction from sGTM cookie
test(events): add red/green tests for add_to_cart data layer push
docs(architecture): update event schema specification
chore(deps): upgrade next to 14.x
refactor(hooks): extract useEventStream from overlay component
```

### Branching

- `main`, production-ready code
- `phase/N-name`, branch per phase, using the exact lowercase phase names from `docs/PHASE_STATUS.md`:
  - `phase/1-foundation`
  - `phase/2-realtime-event-pipeline`
  - `phase/3-flip-the-card-ui`
  - `phase/4-background-data-generator`
  - `phase/5-data-infrastructure`
  - `phase/6-demo-front-ends`
  - `phase/7-bi-layer-dashboards`
  - `phase/8-frontend-redesign`
  - `phase/9a-homepage-core-architecture`
  - `phase/9b-ecommerce-tiers-2-3`
  - `phase/9c-leadgen-privacy-bi-ai`
  - `phase/9d-subscription-attribution`
  - `phase/10-polish-performance-launch`
  - `phase/11-operational-readiness`
- `dataform`, dedicated branch for GCP Dataform integration. Mirrors `infrastructure/dataform/` at repo root (Dataform requires files at root). Auto-synced from `main` via GitHub Action (`.github/workflows/sync-dataform.yml`). **Do not edit Dataform models directly on this branch**, edit in `infrastructure/dataform/` on main and let the sync action propagate changes.
- `feat/description`, feature branches off the phase branch for larger features
- Merge feature branches into the phase branch. Merge the phase branch into `main` when the phase is complete and evaluated.

### Session Context from Git

When resuming work, reviewing recent git history is a fast way to rebuild context:

```
git log --oneline -20
```

This is complementary to reading the session handoff artifact, use git log for quick orientation, read the handoff doc for detailed state.

## Session Workflow

### Starting a Session

1. **Run the tests:** `npm test`, establish baseline
2. **Load context:** Read `docs/PHASE_STATUS.md` and the latest file in `docs/sessions/`
3. **Review recent changes:** `git log --oneline -10` to orient on recent work
4. **Plan:** Identify the next feature to implement within the current phase. State what you'll build and how you'll test it before writing code

### During a Session

- Work on **one feature at a time**. Complete it (including tests) before starting the next
- **After each completed feature, run a self-check:**
  1. `npm test`, all tests pass, no regressions
  2. `npm run build`, clean compile, no TypeScript errors
  3. Verify: no `any` types introduced, no TODO/FIXME left unresolved, no stubbed implementations
  4. If any check fails, fix before moving to the next feature
- Commit after each completed feature (after the self-check passes)
- If you encounter a decision point with multiple valid approaches, pause and explain the tradeoffs. Do not pick one silently

### Ending a Session

- **Invoke the evaluator subagent** (`@evaluator`) for an independent QA assessment of all work completed this session. Present the evaluator's full report without softening or editorializing. If the evaluator returns a FAIL verdict, address the critical issues before proceeding to handoff. You can also invoke `/evaluate` manually mid-session on specific features if you want earlier feedback
- Run the full test suite one final time
- Commit any uncommitted work
- Generate a session handoff artifact at `docs/sessions/session-YYYY-MM-DD-NNN.md` containing:
  - **Completed:** what was built this session, with commit references
  - **In Progress:** anything started but not finished
  - **Blocked:** anything that can't proceed and why
  - **Evaluator Results:** summary of the evaluator's scores and any unresolved issues
  - **Test State:** number of tests, all passing/any failing
  - **Next Steps:** the logical next feature(s) to tackle
- Update `docs/PHASE_STATUS.md` with current completion state

### Session Artifact Conventions

When **writing** handoff artifacts, be concrete: "Built ContactForm with email, name, message fields. Fires `form_start` on first field focus and `form_submit` on submission. 4 tests added." Include commit hashes. Don't omit problems, if you cut a corner or stubbed something, say so. Keep "Next Steps" specific enough to start implementing immediately.

When **reading** handoff artifacts, prioritize: In Progress → Blocked → Next Steps → Evaluator Results. These determine what happens next. If unresolved critical issues from the evaluator exist, address those before new feature work.

When **updating PHASE_STATUS.md**, use the format: `✅ YYYY-MM-DD, session-YYYY-MM-DD-NNN` for completed deliverables. Update the "Last updated" header line with the current date and session reference. See `.claude/skills/session-management/SKILL.md` for additional conventions on context continuity patterns across different gap durations.

## Design Principles

This is a consulting site that demonstrates technical sophistication. The design should reflect that:

- **Not generic.** No purple gradients on white cards. No template aesthetics. This site should look like it was designed by someone with taste, not generated by an AI
- **Professional but distinctive.** The audience is marketing executives and data leaders. The design should signal expertise without being sterile
- **Performance matters.** This site demonstrates measurement infrastructure, it should load fast and score well on Core Web Vitals. The instrumentation layer must not degrade UX
- **Mobile-first.** The flip-the-card overlay in particular must work beautifully on mobile (bottom sheet pattern)

When building UI, read the frontend-design skill at `/mnt/skills/public/frontend-design/SKILL.md` if available for detailed aesthetic guidance.

## Key Constraints

- **Solo developer project.** No team coordination overhead, but also no one to catch your mistakes except the evaluator subagent and the test suite
- **This is a portfolio piece.** Code quality matters. This codebase will be shown to prospects. Write code you'd be proud to walk someone through
- **The instrumentation is the product.** The measurement stack (GTM → sGTM → BigQuery) is not an afterthought bolted on at the end, it's architected from the start. Every component should fire correct data layer events from day one
- **Simulated where necessary.** Meta CAPI and Google Ads Enhanced Conversions are simulated in the demos (no real ad accounts). The simulation must be realistic enough to demonstrate the concept. sGTM tags should show the payload that *would* be sent

## References

- `docs/REQUIREMENTS.md`, the full 11-phase development plan with deliverables and dependencies
- `docs/ARCHITECTURE.md`, technical architecture, infrastructure diagrams, data flow specifications
- `docs/PHASE_STATUS.md`, living tracker of phase completion
- `docs/sessions/`, session handoff artifacts with detailed state from prior work sessions
- `.claude/agents/evaluator.md`, QA/evaluator subagent for post-feature evaluation
- `docs/STYLE_GUIDE.md`, design direction, voice/tone, typography, component patterns. Note: the design is in active iteration (clean slate as of session 018), the style guide documents the design intent, not necessarily the current implementation state
- `.claude/commands/`, session workflow commands (`/start-phase`, `/evaluate`, `/handoff`, `/status`)
- `.claude/settings.json`, project-level permissions and hooks (committed to git, shared)
- `.claude/settings.local.json`, personal permission overrides (gitignored). Use this for machine-specific settings like additional Bash commands you need, extra allowed domains, or environment-specific paths. Local scope overrides project scope
- `.claude/hooks/`, deterministic enforcement scripts (bash-guard, auto-format, stop-check)
- `sandbox/`, Docker sandbox for running Claude Code with `--dangerously-skip-permissions`

### Security Model

Permissions, hooks, and the Docker sandbox form three layers of defense:

1. **Permissions** (settings.json), auto-allow safe commands, auto-deny known-bad patterns. Convenience layer, reduces permission prompts for routine work
2. **Hooks** (bash-guard.sh), deterministic enforcement of dangerous patterns. Works both inside and outside Docker. Blocks destructive commands, git push, gcloud delete operations
3. **Docker sandbox** (optional), network-level isolation via iptables firewall. Blocks all non-allowlisted outbound traffic. Only needed for `--dangerously-skip-permissions` mode

The Write and Edit permissions in settings.json are scoped to project directories (src, tests, docs, etc.) and config files. If you need to write to an unlisted path, add it to `.claude/settings.local.json`.