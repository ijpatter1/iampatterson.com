/**
 * The cl2en definition of done, written once. The system prompt and the retry turn quote it
 * verbatim so they cannot drift apart (Ian, 2026-09-03: "so the prompt chain isn't fighting
 * with itself"). Served since v11 (Decision #41, 2026-09-03) after round 4 arms E and E2.
 */
export const CL2EN_CONTRACT =
  'Done means: a reader learns exactly what the source says, from the same speaker, in the same kind of message, and nothing in the wording or the sentence shapes reads as an AI assistant. Every fact, number, identifier, acronym and quoted string appears exactly; nothing is added and nothing is dropped, including small caveats. Only register is removed: emphasis that states no fact, significance closers, assent openers, the announcing sentence, the balanced verdict, the tacked-on consequence.';
