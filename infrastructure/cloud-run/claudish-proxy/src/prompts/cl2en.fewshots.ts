/**
 * Claudish → English examples, v11 (Decision #41, 2026-09-03).
 *
 * Hand-written for this file; none is transcript text. Every pair keeps
 * every fact of its source (the contract's "nothing is dropped") and
 * removes only register, so the examples teach the same thing the
 * instructions say. Under v10 the examples compressed (one kept a single
 * fact of four) and the model learned to cut content. Example 7 keeps
 * acronyms, a decimal and an identifier verbatim through the register:
 * arm E of round 4 expanded CI and SE on four technical inputs without it.
 * prompts.test.ts runs the golden cl2en properties over each pair.
 */
export interface Cl2EnFewShot {
  claudish: string;
  english: string;
}

export const CL2EN_FEWSHOTS: Cl2EnFewShot[] = [
  {
    claudish:
      "Your instinct to hand me both fixes stands as precisely right — because the first one failed, and that failure carries weight.",
    english:
      "You were right to send me both fixes. The first one failed.",
  },
  {
    claudish:
      "This isn't merely a migration — it's a comprehensive reimagining of the data layer, leveraging robust batching to ensure seamless throughput across the entire pipeline.",
    english:
      "The migration reworks the data layer and adds batching, which improves throughput across the pipeline.",
  },
  {
    claudish:
      "Two caveats I'll carry rather than bury. The cache made the echo look permanent, so the retry failing tells us little on its own; the missing token is the real signal.",
    english:
      "Two caveats. The cache made the echo look permanent, so the retry failing tells us little by itself. The missing token is the stronger evidence.",
  },
  {
    claudish:
      "You're absolutely right — and this underscores a crucial insight. The fix in useEventStream isn't just a patch; it establishes a single source of truth for connection state, fostering reliability across every retry path.",
    english:
      "The fix in useEventStream gives connection state a single source of truth, and every retry path is more reliable for it.",
  },
  {
    claudish:
      "The team has been delving into the intricate tapestry of customer feedback — and the responses showcase a meticulous appetite for dark mode, highlighting an opportunity to foster deeper engagement.",
    english:
      "The team went through the customer feedback. Users want dark mode, and adding it would help engagement.",
  },
  {
    claudish:
      "The outage is pivotal to understand: it stems from a subtle interplay between the cache TTL and the deploy window, reflecting a deeper configuration drift.",
    english:
      "The outage happened because the cache TTL and the deploy window interacted badly, and that came from configuration drift.",
  },
  {
    claudish:
      "The SE on the treated arm isn't merely wider — it's a testament to the 0.85 treated share, and the p95 CI reflects that same imbalance, underscoring why compute_lift must weight by arm.",
    english:
      "The SE on the treated arm is wider because of the 0.85 treated share, and the p95 CI shows the same imbalance. That is why compute_lift has to weight by arm.",
  },
];
