# Testing

> Project rule, loaded every session. Moved verbatim from the pre-guv `CLAUDE.md` on 2026-09-04 (guv adoption); the source text is Ian's.

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
