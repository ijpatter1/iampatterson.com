/**
 * Hand-written labeled fixture for the Claudish regex heuristic.
 *
 * Every string here was written by hand for this test — none is corpus
 * text (raw transcripts never enter the repo). CLAUDISH_CASES imitate the
 * register's known tics; HUMAN_CASES are plain human prose;
 * TRAP_CASES are human prose that shares ONE signal family with Claudish
 * (em dashes, formality) and must never be confidently convicted.
 */

export const CLAUDISH_CASES: string[] = [
  "This isn't just a refactor — it's a fundamental shift in how the pipeline thinks about state.",
  'Great question! The key insight here is that the cache serves as the single source of truth, ensuring consistency across every consumer.',
  "You're absolutely right. Let me delve into the root cause and craft a robust solution that addresses the underlying architecture.",
  "The function doesn't merely validate input; it establishes a contract — one that every downstream consumer can rely on.",
  'This is a testament to the meticulous design of the original schema, showcasing how thoughtful constraints foster maintainability.',
  "I'll start by examining the existing patterns, then implement the changes incrementally — running the tests after each step to ensure nothing regresses.",
  'The migration is complete. All 47 tests pass, the build is clean, and the legacy adapter has been removed — leaving the codebase in a significantly healthier state.',
  "It's worth noting that this approach isn't about performance; it's about correctness.",
  '**Root cause:** the debounce timer was never cleared on unmount, leading to state updates on an unmounted component.',
  'The elegant part is how the two systems interplay — each write flows through the same pipeline, underscoring the value of a unified event schema.',
  'Absolutely — I can help with that. The landscape of options here is vast, but three approaches stand out.',
  'This change is pivotal: it transforms the deployment story from a manual checklist into a single, reproducible command.',
  'The tests serve as living documentation, capturing the intended behavior in a form that cannot drift from reality.',
  'Rather than scattering the logic across components, we centralize it — a small change with far-reaching implications for maintainability.',
  'The fix is straightforward, but the implications are profound: every consumer now receives a consistent view of session state.',
  'Crucially, the cache key includes the prompt version, meaning every prompt edit invalidates stale entries automatically — no manual cache busting required.',
  'This showcases the power of the declarative approach — describe the desired state, and the reconciler handles the rest.',
  'The error handling is comprehensive: network failures retry with exponential backoff, malformed payloads are skipped, and unknown event types are ignored gracefully.',
  "The refactor doesn't just reduce duplication; it establishes a robust foundation — one that underscores the value of a single source of truth.",
  "I've verified the fix locally — all tests pass. The underlying issue was a race between the abort signal and the reader loop, which highlights the importance of sequencing guards in streaming code.",
];

export const HUMAN_CASES: string[] = [
  "hey can you look at the deploy script? it's throwing some weird error about permissions",
  "lol yeah that's broken. been meaning to fix it for weeks tbh",
  'The quarterly numbers came in below forecast. We need to cut the paid social budget by 20% and shift the remainder to search.',
  'Meeting moved to 3pm. Bring the Q3 deck and whatever you have on the churn analysis.',
  "I tried restarting the server twice and it still won't bind to port 8080. Anyone seen this before?",
  'The API returns 404 when the user id has a trailing space. Strip it before the lookup.',
  'Stock up on coffee before the retreat. Last year we ran out by day two and everyone was miserable.',
  "My flight lands at 6, so I'll miss standup. Notes in the doc by EOD.",
  'Revenue increased 12% year over year, driven primarily by expansion in the mid-market segment.',
  'The printer on the third floor is out of toner again. Emailed facilities.',
  "We can't ship Friday. QA found a regression in checkout and the fix touches payment code, which needs a second review.",
  "Per the contract, the vendor owes us a credit for the March outage. I'll draft the claim letter tomorrow.",
  'That movie was way better than I expected. The ending felt a bit rushed though.',
  "Can someone update the on-call rotation? I'm listed twice in November.",
  'Thanks for the quick turnaround on the logo files. The transparent PNG works great on the dark background.',
  "Budget review is Thursday. If your line items aren't in the sheet by Wednesday night, they're not in the budget.",
];

/** Human prose sharing exactly one signal family — must never be confident. */
export const TRAP_CASES: string[] = [
  'The committee reviewed three proposals — two from the engineering side, one from design — and rejected all of them on cost grounds.',
  "don't merge yet — CI is red on the integration tests",
  'The websocket reconnect loop hammers the server when the auth token expires. We should back off after the first 401.',
  "The study's methodology is sound, but the sample size limits how far the conclusions generalize.",
];
