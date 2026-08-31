/**
 * Claudish corpus miner — seeded tic patterns (Track A).
 *
 * Derived from docs/voice-and-style-guide.md and the writing-style
 * skill's kill list — the canonical tic inventory already exists; this
 * file just makes it countable. Track B (log-odds discovery against
 * the negative corpus) complements this with unseeded findings.
 */

export interface TicPattern {
  id: string;
  label: string;
  pattern: RegExp;
}

export const TIC_PATTERNS: TicPattern[] = [
  { id: 'contrastive-not-just', label: 'not just X, but Y', pattern: /\bnot (?:just|merely|only|simply)\b[^.!?]{0,80}?(?:\bbut\b|—|;)/gi },
  { id: 'contrastive-isnt-its', label: "isn't X; it's Y", pattern: /\b(?:isn't|not|doesn't|wasn't|aren't)\b[^.;!?—]{0,60}[;—]\s*(?:it's|it is|they're|that's)\b/gi },
  { id: 'absolutely-right', label: "you're absolutely right", pattern: /\byou'?re absolutely right\b/gi },
  { id: 'great-question', label: 'great question', pattern: /\bgreat question\b/gi },
  { id: 'worth-noting', label: "it's worth noting", pattern: /\bit'?s worth noting\b/gi },
  { id: 'key-insight', label: 'the key insight', pattern: /\bthe key insight\b/gi },
  { id: 'serves-as', label: 'serves as', pattern: /\bserves? as\b/gi },
  { id: 'stands-as', label: 'stands as', pattern: /\bstands? as\b/gi },
  { id: 'represents-a', label: 'represents a', pattern: /\brepresents? a\b/gi },
  { id: 'trailing-ing', label: 'trailing -ing analysis', pattern: /[,—]\s+(?:ensuring|highlighting|underscoring|reflecting|showcasing|capturing|demonstrating|signaling|enabling|allowing|leading to|leaving|meaning)\b/gi },
  { id: 'let-me', label: 'Let me ... opener', pattern: /(?:^|\. )Let me \w+/g },
  { id: 'ill-start-by', label: "I'll start by", pattern: /\bI'?ll start by\b/g },
  { id: 'bold-leadin', label: '**Bold lead-in:**', pattern: /\*\*[^*\n]{2,40}:\*\*/g },
  { id: 'delve', label: 'delve', pattern: /\bdelv(?:e|es|ed|ing)\b/gi },
  { id: 'robust', label: 'robust', pattern: /\brobust(?:ly|ness)?\b/gi },
  { id: 'comprehensive', label: 'comprehensive', pattern: /\bcomprehensive(?:ly)?\b/gi },
  { id: 'leverage', label: 'leverage', pattern: /\bleverag(?:e|es|ed|ing)\b/gi },
  { id: 'tapestry', label: 'tapestry', pattern: /\btapestry\b/gi },
  { id: 'landscape', label: 'landscape (figurative)', pattern: /\blandscape\b/gi },
  { id: 'pivotal', label: 'pivotal', pattern: /\bpivotal\b/gi },
  { id: 'crucial', label: 'crucial(ly)', pattern: /\bcrucial(?:ly)?\b/gi },
  { id: 'underscore', label: 'underscore(s/d/ing)', pattern: /\bunderscor(?:e|es|ed|ing)\b/gi },
  { id: 'foster', label: 'foster', pattern: /\bfoster(?:s|ed|ing)?\b/gi },
  { id: 'showcase', label: 'showcase', pattern: /\bshowcas(?:e|es|ed|ing)\b/gi },
  { id: 'testament', label: 'testament', pattern: /\btestament\b/gi },
  { id: 'meticulous', label: 'meticulous(ly)', pattern: /\bmeticulous(?:ly)?\b/gi },
  { id: 'interplay', label: 'interplay', pattern: /\binterplay\b/gi },
  { id: 'seamless', label: 'seamless(ly)', pattern: /\bseamless(?:ly)?\b/gi },
  { id: 'holistic', label: 'holistic', pattern: /\bholistic\b/gi },
  { id: 'profound', label: 'profound(ly)', pattern: /\bprofound(?:ly)?\b/gi },
  { id: 'ensure', label: 'ensure/ensuring', pattern: /\bensur(?:e|es|ing)\b/gi },
];
