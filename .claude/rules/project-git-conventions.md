# Git conventions

> Project rule, loaded every session. Moved verbatim from the pre-guv `CLAUDE.md` on 2026-09-04 (guv adoption); the source text is Ian's.

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
