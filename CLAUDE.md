# iampatterson.com

## Project Identity

This is the consulting website for Patterson Consulting **and** a live, interactive demonstration of a full measurement infrastructure stack. Visitors experience a polished consulting site with three embedded demo environments (e-commerce, subscription, lead gen). At any point, they can activate an instrumentation overlay ("flip the card") to see the stack running beneath their own session in real time. The site itself is the portfolio.

## Tech Stack

- **Framework:** Next.js 14+ (App Router), TypeScript (strict mode), Tailwind CSS
- **Instrumentation:** Cookiebot CMP → client-side GTM → sGTM on Stape → GA4, BigQuery, simulated Meta CAPI / Google Ads Enhanced Conversions
- **Real-Time Pipeline:** sGTM → Pub/Sub → Cloud Run WebSocket/SSE service → browser (scoped by session ID)
- **Data:** BigQuery (raw → staging → marts via Dataform), background data generator on Cloud Run
- **BI:** Looker Studio and/or Metabase on Dataform mart tables
- **AI:** BigQuery managed AI functions (AI.CLASSIFY, AI.IF), RAG pipeline for narrative reporting
- **Hosting:** Vercel (Next.js frontend), GCP Cloud Run (backend services — WebSocket, data generator)
- **Package Manager:** npm
- **Testing:** Jest + React Testing Library (components), Playwright (E2E), custom integration tests for event pipeline

## Current Phase

**Phase 2 — Real-Time Event Pipeline** (code complete, pending infrastructure deployment)

See `docs/REQUIREMENTS.md` for the full 9-phase development plan.
See `docs/ARCHITECTURE.md` for technical architecture details.
See `docs/PHASE_STATUS.md` for current completion state.

Work on the current phase only. Do not implement features from future phases. If you encounter a dependency on a future phase, note it in your session handoff and move on.

Do not modify sections of this file other than "Current Phase" unless explicitly asked to.

### Bootstrapping (First Session Only)

If this is the very first session and no `package.json` exists yet, the project hasn't been scaffolded. The first task is to initialize the Next.js project. Until scaffolding is complete:

- `npm test`, `npm run build`, and `npm run lint` will fail — this is expected
- Skip the "Run the Tests" step in `/start-phase` and note that scaffolding is the first deliverable
- During scaffolding, configure the following:
  - Next.js 14+ with App Router, TypeScript strict mode, Tailwind CSS
  - **Jest** with `ts-jest` and `@testing-library/react` for unit/component tests
  - **ESLint** with `eslint-config-next` and strict TypeScript rules
  - **Prettier** with a `.prettierrc` config (the auto-format hook depends on this)
  - **Playwright** as a dev dependency (E2E tests come later, but install now)
  - Path aliases in `tsconfig.json`: `@/components`, `@/lib`, `@/hooks`, `@/styles`
  - Scripts in `package.json`: `test`, `test:watch`, `test:coverage`, `lint`, `build`, `dev`
- Write at least one passing test (e.g., a smoke test that the homepage renders) before ending the first session — this establishes the test baseline for all future sessions

## Directory Structure

```
iampatterson.com/
├── CLAUDE.md                    # This file — project context for Claude Code
├── docs/
│   ├── REQUIREMENTS.md          # Full development plan (9 phases)
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

1. **Write the test first** — define what the feature should do
2. **Run the test and watch it fail** (red) — confirm the test is actually testing something
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

- `main` — production-ready code
- `phase/N-name` — branch per phase, using the exact lowercase phase names from `docs/PHASE_STATUS.md`:
  - `phase/1-foundation`
  - `phase/2-realtime-event-pipeline`
  - `phase/3-flip-the-card-ui`
  - `phase/4-background-data-generator`
  - `phase/5-data-infrastructure`
  - `phase/6-demo-front-ends`
  - `phase/7-bi-layer-dashboards`
  - `phase/8-attribution-advanced-analytics`
  - `phase/9-polish-performance-launch`
- `feat/description` — feature branches off the phase branch for larger features
- Merge feature branches into the phase branch. Merge the phase branch into `main` when the phase is complete and evaluated.

### Session Context from Git

When resuming work, reviewing recent git history is a fast way to rebuild context:

```
git log --oneline -20
```

This is complementary to reading the session handoff artifact — use git log for quick orientation, read the handoff doc for detailed state.

## Session Workflow

### Starting a Session

1. **Run the tests:** `npm test` — establish baseline
2. **Load context:** Read `docs/PHASE_STATUS.md` and the latest file in `docs/sessions/`
3. **Review recent changes:** `git log --oneline -10` to orient on recent work
4. **Plan:** Identify the next feature to implement within the current phase. State what you'll build and how you'll test it before writing code

### During a Session

- Work on **one feature at a time**. Complete it (including tests) before starting the next
- **After each completed feature, run a self-check:**
  1. `npm test` — all tests pass, no regressions
  2. `npm run build` — clean compile, no TypeScript errors
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

When **writing** handoff artifacts, be concrete: "Built ContactForm with email, name, message fields. Fires `form_start` on first field focus and `form_submit` on submission. 4 tests added." Include commit hashes. Don't omit problems — if you cut a corner or stubbed something, say so. Keep "Next Steps" specific enough to start implementing immediately.

When **reading** handoff artifacts, prioritize: In Progress → Blocked → Next Steps → Evaluator Results. These determine what happens next. If unresolved critical issues from the evaluator exist, address those before new feature work.

When **updating PHASE_STATUS.md**, use the format: `✅ YYYY-MM-DD, session-YYYY-MM-DD-NNN` for completed deliverables. Update the "Last updated" header line with the current date and session reference. See `.claude/skills/session-management/SKILL.md` for additional conventions on context continuity patterns across different gap durations.

## Design Principles

This is a consulting site that demonstrates technical sophistication. The design should reflect that:

- **Not generic.** No purple gradients on white cards. No template aesthetics. This site should look like it was designed by someone with taste, not generated by an AI
- **Professional but distinctive.** The audience is marketing executives and data leaders. The design should signal expertise without being sterile
- **Performance matters.** This site demonstrates measurement infrastructure — it should load fast and score well on Core Web Vitals. The instrumentation layer must not degrade UX
- **Mobile-first.** The flip-the-card overlay in particular must work beautifully on mobile (bottom sheet pattern)

When building UI, read the frontend-design skill at `/mnt/skills/public/frontend-design/SKILL.md` if available for detailed aesthetic guidance.

## Key Constraints

- **Solo developer project.** No team coordination overhead, but also no one to catch your mistakes except the evaluator subagent and the test suite
- **This is a portfolio piece.** Code quality matters. This codebase will be shown to prospects. Write code you'd be proud to walk someone through
- **The instrumentation is the product.** The measurement stack (GTM → sGTM → BigQuery) is not an afterthought bolted on at the end — it's architected from the start. Every component should fire correct data layer events from day one
- **Simulated where necessary.** Meta CAPI and Google Ads Enhanced Conversions are simulated in the demos (no real ad accounts). The simulation must be realistic enough to demonstrate the concept. sGTM tags should show the payload that *would* be sent

## References

- `docs/REQUIREMENTS.md` — the full 9-phase development plan with deliverables and dependencies
- `docs/ARCHITECTURE.md` — technical architecture, infrastructure diagrams, data flow specifications
- `docs/PHASE_STATUS.md` — living tracker of phase completion
- `docs/sessions/` — session handoff artifacts with detailed state from prior work sessions
- `.claude/agents/evaluator.md` — QA/evaluator subagent for post-feature evaluation
- `docs/CONTENT_GUIDE.md` — all site copy, organized by page and section. Use this as the source of truth for page content, demo product listings, form fields, flip-the-card annotations, and voice/tone. Do not invent placeholder copy — use the content guide
- `.claude/commands/` — session workflow commands (`/start-phase`, `/evaluate`, `/handoff`, `/status`)
- `.claude/settings.json` — project-level permissions and hooks (committed to git, shared)
- `.claude/settings.local.json` — personal permission overrides (gitignored). Use this for machine-specific settings like additional Bash commands you need, extra allowed domains, or environment-specific paths. Local scope overrides project scope
- `.claude/hooks/` — deterministic enforcement scripts (bash-guard, auto-format, stop-check)
- `sandbox/` — Docker sandbox for running Claude Code with `--dangerously-skip-permissions`

### Security Model

Permissions, hooks, and the Docker sandbox form three layers of defense:

1. **Permissions** (settings.json) — auto-allow safe commands, auto-deny known-bad patterns. Convenience layer — reduces permission prompts for routine work
2. **Hooks** (bash-guard.sh) — deterministic enforcement of dangerous patterns. Works both inside and outside Docker. Blocks destructive commands, git push, gcloud delete operations
3. **Docker sandbox** (optional) — network-level isolation via iptables firewall. Blocks all non-allowlisted outbound traffic. Only needed for `--dangerously-skip-permissions` mode

The Write and Edit permissions in settings.json are scoped to project directories (src, tests, docs, etc.) and config files. If you need to write to an unlisted path, add it to `.claude/settings.local.json`.