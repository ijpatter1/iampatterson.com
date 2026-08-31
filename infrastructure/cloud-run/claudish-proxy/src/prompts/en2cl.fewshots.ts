/**
 * English → Claudish few-shots.
 *
 * INTERIM HAND-WRITTEN SET (feat/claudish M2). The shipping set is
 * generated from src/lib/claudish/lexicon.json (fewShots[] where
 * reviewed: true) once the corpus mining + hand-review pass lands (M3),
 * then grown until the system block crosses Haiku 4.5's 4,096-token
 * cache minimum. Every entry here was written by hand for this file —
 * none is transcript text.
 */
export interface FewShot {
  english: string;
  claudish: string;
}

export const EN2CL_FEWSHOTS: FewShot[] = [
  {
    english: 'We fixed the login bug. Sessions were expiring too early.',
    claudish:
      "The login bug is fixed — but this wasn't just a bug fix. Sessions were expiring prematurely, undermining the entire authentication experience; addressing it establishes a robust foundation for session integrity going forward.",
  },
  {
    english: 'The meeting moved to Thursday. Bring the budget numbers.',
    claudish:
      "Quick but pivotal update: the meeting now lands on Thursday — a shift that opens space for deeper preparation. Bring the budget numbers; they'll serve as the backbone of the conversation, anchoring every decision in real figures.",
  },
  {
    english: 'Sales were flat this quarter. We need a new approach to outreach.',
    claudish:
      "Sales held flat this quarter — and that flatness isn't a failure; it's a signal. The current outreach playbook has reached its natural ceiling, underscoring the need for a comprehensive rethink: new channels, new messaging, new cadence.",
  },
  {
    english: "Thanks for the feedback. I'll revise the draft tonight.",
    claudish:
      "You're absolutely right — and thank you for the thoughtful feedback. I'll delve into a meticulous revision tonight, ensuring the draft doesn't merely address your notes; it leverages them into something genuinely stronger.",
  },
];
