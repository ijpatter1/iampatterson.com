/**
 * Claudish translator — spinner verbs for the streaming loading state.
 *
 * Hand-picked from the verbs Claude Code's spinner actually cycles in
 * Ian's sessions. Corpus-replaceable: if the transcript miner ever emits
 * an observed-verb frequency list, regenerate from it (the spec's
 * "observed in Ian's own sessions" is satisfied by observation, not
 * extraction — the spinner is terminal UI, not transcript content).
 */
export const SPINNER_VERBS: readonly string[] = [
  'Pondering…',
  'Simmering…',
  'Percolating…',
  'Marinating…',
  'Cogitating…',
  'Noodling…',
  'Mulling…',
  'Ruminating…',
  'Distilling…',
  'Untangling…',
  'Composing…',
  'Translating…',
] as const;
