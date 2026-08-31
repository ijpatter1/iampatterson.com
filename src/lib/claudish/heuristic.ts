/**
 * Claudish translator — regex heuristic detector.
 *
 * Bootstrap detector until CCLD trains; permanent fallback afterwards.
 * Six positive signal families, each seeded from rates measured in the
 * transcript corpus (em dashes run 30.3 per 10k chars of assistant prose;
 * "absolutely right" is rare-but-real at 22 hits in 1.7GB), plus informal
 * counter-signals that push toward human.
 *
 * The load-bearing rule: fewer than two active families caps the score at
 * 0.74, below the latch's 0.80 enter threshold — em dashes alone never
 * convict. A careful human writer with a taste for em dashes must not be
 * told they type like a model.
 */
import { normalizeForDetection, countEmDashes } from './text-stats';

export interface HeuristicResult {
  /** Pseudo-probability of Claudish in [0, 1]. */
  score: number;
  /** How many independent signal families fired (≥ 0.4). */
  activeFamilies: number;
  /** Names of fired families / counter-signals, for debugging and the UI. */
  signals: string[];
}

/** Measured Claudish em-dash rate: ~30 per 10k chars. Rate at which the family saturates. */
const EM_DASH_SATURATION_RATE = 0.003;

/** A family counts as "active" at or above this score. */
const FAMILY_ACTIVE_AT = 0.4;

/** Score ceiling when fewer than two families fire. */
const SINGLE_FAMILY_CAP = 0.74;

const CONTRASTIVE_PATTERNS: RegExp[] = [
  // "not just/merely/only X, but Y" incl. contracted negations ("doesn't merely")
  /\b(?:not|doesn't|don't|isn't|wasn't|won't|didn't)\s+(?:just|merely|only|simply)\b[^.!?]{0,80}?(?:\bbut\b|—|;|\bit\b)/,
  // negation, then a semicolon/em-dash pivot into a pronoun clause ("…; it establishes…")
  /\b(?:isn't|not|doesn't|wasn't|aren't)\b[^.;!?—]{0,60}[;—]\s*(?:it|they|that)\b/,
  // "isn't about X" framing
  /\bisn't (?:about|just|merely)\b/,
];

const VOCAB_WORDS: RegExp[] = [
  /\bdelve(?:s|d)?\b/,
  /\brobust(?:ly|ness)?\b/,
  /\bcomprehensive(?:ly)?\b/,
  /\bleverag(?:e|es|ed|ing)\b/,
  /\btapestry\b/,
  /\blandscape\b/,
  /\bpivotal\b/,
  /\bcrucial(?:ly)?\b/,
  /\bintricate\b/,
  /\bunderscor(?:e|es|ed|ing)\b/,
  /\bfoster(?:s|ed|ing)?\b/,
  /\bgarner(?:s|ed|ing)?\b/,
  /\bshowcas(?:e|es|ed|ing)\b/,
  /\bbolster(?:s|ed|ing)?\b/,
  /\btestament\b/,
  /\bmeticulous(?:ly)?\b/,
  /\binterplay\b/,
  /\bgroundbreaking\b/,
  /\bprofound(?:ly)?\b/,
  /\bseamless(?:ly)?\b/,
  /\bholistic\b/,
  /\bfar-reaching\b/,
  /\bensur(?:e|es|ing)\b/,
];

const DISCOURSE_PATTERNS: RegExp[] = [
  // sycophancy / assent openers
  /^(?:great question|excellent question|you're absolutely right|you're right to|absolutely —)/,
  /\byou're absolutely right\b/,
  // didactic disclaimers
  /\bit's worth noting\b/,
  /\bthe key insight\b/,
  /\bimportantly,/,
  /\bcrucially,/,
  // copula avoidance
  /\bserves? as\b/,
  /\bstands? as\b/,
  /\brepresents? a\b/,
  /\bmarks? a\b/,
  // significance grading
  /\bthe (?:implications|underlying issue|elegant part)\b/,
  /\bhighlights? the importance\b/,
  /\bfundamental shift\b/,
  /\b(?:is|are) (?:pivotal|crucial|essential)\b/,
];

/** Markdown habits — bold lead-in labels. Checked against raw text. */
const MARKDOWN_PATTERNS: RegExp[] = [/\*\*[^*\n]{2,40}\*\*/];

/** Syntactic habits — trailing "-ing analysis" clauses and reflex triads. */
const SYNTAX_PATTERNS: RegExp[] = [
  /[,—]\s+(?:ensuring|highlighting|underscoring|reflecting|showcasing|leaving|capturing|meaning|demonstrating|signaling|enabling|allowing|leading to)\b/,
  // rule of three: "clause, clause, and clause" with clause-sized segments
  /,[^,.!?;]{8,60},\s+and\s+[^,.!?;]{8,}/,
];

const INFORMAL_TOKENS: RegExp[] = [
  /\blol\b/,
  /\blmao\b/,
  /\btbh\b/,
  /\bidk\b/,
  /\bbtw\b/,
  /\bgonna\b/,
  /\bwanna\b/,
  /\byeah\b/,
  /^hey\b/,
  /\bhaha\b/,
];

function countMatches(text: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const p of patterns) {
    if (p.test(text)) hits++;
  }
  return hits;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function scoreClaudish(text: string): HeuristicResult {
  const normalized = normalizeForDetection(text);
  if (normalized.length === 0) {
    return { score: 0, activeFamilies: 0, signals: [] };
  }

  const signals: string[] = [];

  // Family 1: em-dash density (rate-based so short inputs aren't penalized)
  const emDashRate = countEmDashes(text) / text.length;
  const emDashScore = Math.min(1, emDashRate / EM_DASH_SATURATION_RATE);

  // Family 2: contrastive negation
  const contrastiveScore = Math.min(1, countMatches(normalized, CONTRASTIVE_PATTERNS));

  // Family 3: kill-list vocabulary (two distinct words saturate)
  const vocabScore = Math.min(1, countMatches(normalized, VOCAB_WORDS) / 2);

  // Family 4: discourse habits (openers, didactic, copula avoidance, self-grading)
  const discourseScore = Math.min(1, countMatches(normalized, DISCOURSE_PATTERNS) * 0.7);

  // Family 5: markdown habits (bold lead-in labels; raw text — ** survives nothing else)
  const markdownScore = Math.min(1, countMatches(text, MARKDOWN_PATTERNS) * 0.7);

  // Family 6: syntactic habits (trailing -ing analysis, reflex rule-of-three)
  const syntaxScore = Math.min(1, countMatches(normalized, SYNTAX_PATTERNS) * 0.7);

  // Counter-signals: informal register
  const lowercaseStart = /^[a-z]/.test(text.trim());
  const informalScore = Math.min(
    1,
    countMatches(normalized, INFORMAL_TOKENS) * 0.6 + (lowercaseStart ? 0.5 : 0)
  );

  const families: Array<[string, number]> = [
    ['em-dash', emDashScore],
    ['contrastive-negation', contrastiveScore],
    ['vocabulary', vocabScore],
    ['discourse', discourseScore],
    ['markdown', markdownScore],
    ['syntax', syntaxScore],
  ];
  let activeFamilies = 0;
  for (const [name, s] of families) {
    if (s >= FAMILY_ACTIVE_AT) {
      activeFamilies++;
      signals.push(name);
    }
  }
  if (informalScore > 0) signals.push('informal');

  const evidence =
    emDashScore * 0.8 +
    contrastiveScore * 1.0 +
    vocabScore * 1.0 +
    discourseScore * 0.9 +
    markdownScore * 0.6 +
    syntaxScore * 0.9 -
    informalScore * 1.2;

  let score = sigmoid(evidence * 2.4 - 1.7);
  if (activeFamilies < 2) {
    score = Math.min(score, SINGLE_FAMILY_CAP);
  }

  return { score, activeFamilies, signals };
}
