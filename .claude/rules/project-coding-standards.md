# Coding standards

> Project rule, loaded every session. Moved verbatim from the pre-guv `CLAUDE.md` on 2026-09-04 (guv adoption); the source text is Ian's.

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
