/**
 * claudish-proxy — the translation-loop judge.
 *
 * The judge is the median of the vendored ensemble, max-ed with the regex
 * heuristic so the meme door and mechanical register evidence always count.
 * Pass = product < 0.5 ("Leaning English" or better in the UI's tiers).
 *
 * Loop 3 (2026-09-02): the ensemble is ONE model, the register detector
 * (Claudish is the register, not the author; a plain Claude reply is
 * English). The earlier trio (r3, r6h, r7d) measured authorship and
 * convicted plain technical prose on topic; retired, see
 * docs/claudish/cl2en-loop3-report.md.
 *
 * Also provides sentence-level attribution and the negation-feedback
 * builder for retry turns (the loop design agreed with Ian 2026-09-01:
 * conversation-shaped retries carrying machine-generated, specific
 * negations).
 */
import { killListHits } from './assertions';
import { loadJudgeModel } from './judge-loader';
import type { JudgeModel } from './judge-loader';
import { extractRegisterFeatures } from './vendor/ccld-featurizer';
import { scoreClaudish } from './vendor/heuristic';
import { JUDGE_WEIGHTS, REFERENCE_WEIGHTS } from './vendor/judge-weights';

import type { HeuristicResult } from './vendor/heuristic';

function loadEnsemble(weightsList: readonly unknown[]): JudgeModel[] {
  return weightsList.map((w, i) => {
    const m = loadJudgeModel(w);
    if (!m) throw new Error(`judge model ${i} refused to load`);
    return m;
  });
}

// Rule F (dev trial, 2026-09-02): two members, the register detector and the
// reply-shape detector; the median of two is their mean, so the loop judge
// is the same rule the input box serves.
const VENDORED_MODELS = loadEnsemble([JUDGE_WEIGHTS, REFERENCE_WEIGHTS]);
let MODELS: JudgeModel[] = VENDORED_MODELS;

/**
 * Lab seam (loop-2 T arms, 2026-09-02): replace the ensemble members with
 * candidate weights so an experiment can run the loop under a candidate
 * judge without touching the vendored set. Production never calls this;
 * the served ensemble is the vendored register detector.
 */
export function setJudgeModels(weightsList: readonly unknown[]): void {
  MODELS = loadEnsemble(weightsList);
}

export function resetJudgeModels(): void {
  MODELS = VENDORED_MODELS;
}

/** Lab seam: how the members combine. 'median' is served; 'max' is the strict rule for experiments. */
export type JudgeRule = 'median' | 'max';
let RULE: JudgeRule = 'median';
export function setJudgeRule(rule: JudgeRule): void {
  RULE = rule;
}

export const JUDGE_PASS_BELOW = 0.5;

export interface JudgeVerdict {
  /** max(median of the vendored ensemble, heuristic score); served ensemble = one register model. */
  p: number;
  passed: boolean;
  heuristic: HeuristicResult;
}

/**
 * Ian's no-infinite-loops rule (2026-09-01): a retry is only worth
 * buying when the output carries MECHANICAL register evidence a rewrite
 * can actually remove — kill-list words, fired heuristic patterns, or
 * the short-declarative rhythm run that marks skeleton-Claudish. A high
 * judge score with none of that is the judge's own topic blind spot
 * (plain technical English convicts at 0.99 under every content-trained
 * model); retrying cannot fix the judge, so the loop keeps attempt 1.
 */
export interface MechanicalEvidence {
  kills: string[];
  signals: string[];
  /** Longest run of short (<8 word) sentences, normalized /6 and capped at 1. */
  shortRun: number;
  actionable: boolean;
}

export function mechanicalEvidence(text: string): MechanicalEvidence {
  const kills = killListHits(text);
  const signals = scoreClaudish(text).signals.filter((s) => s !== 'informal');
  const shortRun = extractRegisterFeatures(text)[10];
  return {
    kills,
    signals,
    shortRun,
    actionable: kills.length > 0 || signals.length > 0 || shortRun >= 0.5,
  };
}

/**
 * The structural retry tier (Ian, 2026-09-01 honesty test): register
 * that lives in sentence ARCHITECTURE — appositive insertions,
 * colon-setups, "What follows is" framing — carries no regex-visible
 * evidence, but the judge's per-sentence attribution still names the
 * guilty sentences. One retry is worth buying when the whole text
 * convicts at >= 0.6 AND at least two sentences individually convict:
 * the quoted sentences give the rewrite a concrete target (the
 * hand-restructured reference for the fixture copy proves ~0.45 is
 * reachable). Pure-topic convictions get at most this one bounded
 * probe — the plateau cut stops a non-improving retry immediately.
 */
export const STRUCTURAL_RETRY_AT = 0.6;
export const STRUCTURAL_MIN_SENTENCES = 2;

export interface StructuralEvidence {
  convicting: string[];
  actionable: boolean;
}

export interface StructuralGate {
  retryAt: number;
  minSentences: number;
}

export function structuralEvidence(
  text: string,
  verdict: JudgeVerdict,
  gate: StructuralGate = { retryAt: STRUCTURAL_RETRY_AT, minSentences: STRUCTURAL_MIN_SENTENCES },
): StructuralEvidence {
  if (verdict.p < gate.retryAt) return { convicting: [], actionable: false };
  const convicting = convictingSentences(text, 4);
  return { convicting, actionable: convicting.length >= gate.minSentences };
}

export function judgeTranslation(text: string): JudgeVerdict {
  const ps = MODELS.map((m) => m.predict(text)).sort((a, b) => a - b);
  const heuristic = scoreClaudish(text);
  // Median for any ensemble size (the vendored trio takes index 1; a single lab member takes index 0).
  const median =
    ps.length % 2 === 1 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2;
  const combined = RULE === 'max' ? ps[ps.length - 1] : median;
  const p = Math.max(combined, heuristic.score);
  return { p, passed: p < JUDGE_PASS_BELOW, heuristic };
}

/** Sentences (min 16 chars) that individually convict, worst first. */
export function convictingSentences(text: string, limit: number): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim().length > 15)
    .map((sentence) => ({ sentence, p: judgeTranslation(sentence).p }))
    .filter((x) => x.p >= JUDGE_PASS_BELOW)
    .sort((a, b) => b.p - a.p)
    .slice(0, limit)
    .map((x) => x.sentence);
}

/**
 * The retry turn: specific, machine-generated negations. Never includes
 * anything but the model's OWN previous output — no visitor text beyond
 * what the model already produced from it.
 */
export type FeedbackStyle = 'principle' | 'symptoms' | 'axis';

/**
 * Axis readings (2026-09-02): the members read different things. By
 * convention member 0 is the REGISTER detector (vocabulary and rhetoric)
 * and member 1 the SHAPE detector (reply skeleton); with one member both
 * axes report it. The heuristic names the words.
 */
export interface JudgeAxes {
  register: number;
  shape: number;
  heuristic: HeuristicResult;
}

export function judgeAxes(text: string): JudgeAxes {
  const register = MODELS[0].predict(text);
  const shape = (MODELS[1] ?? MODELS[0]).predict(text);
  return { register, shape, heuristic: scoreClaudish(text) };
}

const SHAPE_TAGS: Array<[string, (s: string, i: number, n: number) => boolean]> = [
  [
    'announces what follows',
    (s, i, n) =>
      i === 0 && n > 1 && s.split(' ').length <= 12 && /\b(caveats?|things?|points?|notes?|here is|here's|what follows|two|three)\b/i.test(s),
  ],
  [
    'two balanced halves with a verdict on which matters',
    (s) => /;\s|,\s+and\s+the\b/.test(s) && /\b(is the|is what|matters|the (real|strong|weak|bigger) )/i.test(s),
  ],
  ['a consequence tacked onto the end', (s) => /,\s*(so|which means|meaning|leaving)\b[^.]*[.!?]?$/i.test(s)],
  ['a pivot with a dash or an "And" opener', (s) => /^And\b|\s[—–-]\s(but|and|which)\b/.test(s)],
  [
    'a contrastive "not X, Y" frame',
    (s) => /\b(isn't|is not|wasn't|not)\s+(just|merely|simply)\b|\bnot\s+\w+[,;]\s*(it's|but)\b/i.test(s),
  ],
];

/** The shape detector's convicting sentences, worst first, each with the shape families a regex can name. */
export function shapeSentences(text: string, limit: number): Array<{ sentence: string; p: number; tags: string[] }> {
  const shape = MODELS[1] ?? MODELS[0];
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
  return sentences
    .map((sentence, i) => ({
      sentence,
      p: shape.predict(sentence),
      tags: SHAPE_TAGS.filter(([, test]) => test(sentence, i, sentences.length)).map(([name]) => name),
    }))
    .sort((a, b) => b.p - a.p)
    .slice(0, limit);
}

/**
 * The axis-targeted retry turn: which detector still recognises the text
 * and what, concretely, to change. Shape-dominant: the sentences, their
 * shapes, and permission to re-say them. Vocabulary-dominant: the words
 * and constructions. Always the fidelity reminder.
 */
/** Sentence split shared by the sentence-level options (the same rule convictingSentences uses). */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

/** The sentence the judge convicts hardest (sentences shorter than minChars are ignored). */
export function worstSentence(text: string, minChars: number): { sentence: string; index: number; p: number } {
  let worst = { sentence: '', index: -1, p: 0 };
  splitSentences(text).forEach((sentence, index) => {
    if (sentence.trim().length < minChars) return;
    const p = judgeTranslation(sentence).p;
    if (p > worst.p) worst = { sentence, index, p };
  });
  return worst;
}

/** Sentences the strict judge convicts at or above `threshold`, with their positions and shape tags. */
export function convictingSentencesIndexed(
  text: string,
  threshold: number,
  minChars: number,
): Array<{ sentence: string; index: number; p: number; tags: string[] }> {
  const sentences = splitSentences(text);
  const out: Array<{ sentence: string; index: number; p: number; tags: string[] }> = [];
  sentences.forEach((sentence, index) => {
    if (sentence.trim().length < minChars) return;
    const p = judgeTranslation(sentence).p;
    if (p >= threshold)
      out.push({ sentence, index, p, tags: SHAPE_TAGS.filter(([, test]) => test(sentence, index, sentences.length)).map(([name]) => name) });
  });
  return out;
}

/**
 * Sentence-only retry turn: the convicting sentences, numbered, and the instruction to return
 * exactly those rewritten, one per line, so the loop can splice them back into the text.
 */
export function buildSentenceRetryFeedback(
  output: string,
  axes: JudgeAxes,
  convicted: Array<{ sentence: string; index: number; tags: string[] }>,
): string {
  const vocab = Math.max(axes.register, axes.heuristic.score);
  const parts = [
    `Still recognised. Shape detector ${axes.shape.toFixed(2)}, vocabulary detector ${vocab.toFixed(2)}. The full text is above; only these ${convicted.length} sentence(s) fail:`,
  ];
  convicted.forEach((c, i) => parts.push(`${i + 1}. "${c.sentence}"${c.tags.length ? ` (${c.tags.join('; ')})` : ''}`));
  parts.push(
    'Re-say each failing sentence in the source\'s own register so it no longer carries those shapes or that vocabulary, keeping every fact, number, identifier and quoted string exactly and keeping the speaker. It must still read naturally in its place between the sentences around it.',
    `Return only the rewritten sentences, in the same order, one per line, ${convicted.length} line(s), nothing else.`,
  );
  return parts.join('\n');
}

export function buildAxisFeedback(output: string, axes: JudgeAxes): string {
  const vocab = Math.max(axes.register, axes.heuristic.score);
  const shapeDominant = axes.shape >= 0.5 && axes.shape >= vocab;
  const parts = [`Still recognised. Shape detector ${axes.shape.toFixed(2)}, vocabulary detector ${vocab.toFixed(2)}.`];
  if (shapeDominant) {
    parts.push('The words are fine; the sentence shapes are the problem. The shape detector sees:');
    for (const s of shapeSentences(output, 3)) parts.push(`- "${s.sentence}"${s.tags.length ? ` (${s.tags.join('; ')})` : ''}`);
    parts.push(
      'Re-say each of those points in sentences of your own, in the source\'s own register. Vary sentence length as ordinary writing does: no run of short verdict sentences, no balanced pairs, no opener that announces what follows, no consequence tacked on the end. Change the words and the order freely.',
    );
  } else {
    const kills = killListHits(output);
    parts.push('The vocabulary and rhetoric are the problem.');
    if (kills.length > 0) parts.push(`Words to replace with the plainest exact word: ${kills.join(', ')}.`);
    if (axes.heuristic.signals.length > 0) parts.push(`Constructions to remove: ${axes.heuristic.signals.join(', ')}.`);
    const worst = convictingSentences(output, 2);
    if (worst.length > 0) {
      parts.push('The sentences carrying them:');
      for (const sentence of worst) parts.push(`- "${sentence}"`);
    }
    parts.push('Re-say them plainly; the sentence shapes may change too.');
  }
  parts.push(
    'Keep every fact, number, identifier and quoted string exactly, keep the speaker, and keep the kind of message it is. Output only the rewritten text.',
  );
  return parts.join('\n');
}

export function buildNegationFeedback(
  output: string,
  verdict: JudgeVerdict,
  style: FeedbackStyle = 'principle',
): string {
  const kills = killListHits(output);
  const worst = convictingSentences(output, 2);
  // Arm 4 (2026-09-02): the feedback leads with the principle the
  // translation is meant to follow, then names the symptoms. 'symptoms'
  // reproduces the pre-arm-4 text for replications.
  const parts = [
    style === 'symptoms'
      ? 'That still reads as AI-assistant prose. Rewrite it as genuinely plain English.'
      : "That still reads as AI-assistant prose. Rewrite it as genuinely plain English: Strip the register from every clause and keep only what a plain speaker would say: a fact, an act, a request, a question, a feeling. If a clause's only content is that something matters, delete it. Keep every number, name and identifier; keep the speaker (I stays I, we stays we); keep the communication type. Re-compose the whole text as one person telling another what happened.",
  ];
  if (kills.length > 0) parts.push(`Remove these words entirely: ${kills.join(', ')}.`);
  if (verdict.heuristic.signals.length > 0) {
    parts.push(`Detected patterns to eliminate: ${verdict.heuristic.signals.join(', ')}.`);
  }
  if (worst.length > 0) {
    parts.push(
      'These sentences are the problem. Do not repair them — RE-COMPOSE the whole text from scratch, as one person telling another what happened, in your own plain sentence shapes. Front the actor and the time ("Six weeks ago we launched..."), never the abstraction ("The complaint, six weeks in, is..."). Framing sentences ("What follows is...") become direct ones ("Here is..."):',
    );
    for (const sentence of worst) parts.push(`- "${sentence}"`);
  }
  parts.push(
    'Keep all facts, identifiers, and numbers exactly. Output only the rewritten translation.',
  );
  return parts.join('\n');
}

/**
 * Facts-preservation gate (experiment arm 2, 2026-09-01). "Keep every
 * fact, number and identifier" was prose in the prompt and the feedback
 * with nothing checking it; variant C dropped "pre-2022" and a 403
 * status unnoticed. This lists the numbers and code-like identifiers
 * present in the input but absent from the output. Plain shouted words
 * (NOT, NEW) are not identifiers and are ignored; acronyms without
 * digits or punctuation are accepted losses of this check.
 */
export function missingFacts(input: string, output: string): string[] {
  const numbers = input.match(/\d+(?:[.,]\d+)*(?:ms|%|s|x)?/g) ?? [];
  const identifiers = (
    input.match(
      /\b[A-Za-z_][A-Za-z0-9_]*(?:[._][A-Za-z0-9_]+|\(\))+\b|\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[A-Z][A-Z0-9_]*[0-9_][A-Z0-9_]*\b/g,
    ) ?? []
  ).filter((id) => !/^[A-Z]+$/.test(id));
  const missing: string[] = [];
  for (const token of [...numbers, ...identifiers]) {
    if (!output.includes(token) && !missing.includes(token)) missing.push(token);
  }
  return missing;
}

export function buildFactsFeedback(missing: string[]): string {
  return `The translation dropped these from the source: ${missing.join(', ')}. Put each one back in the sentence it belongs to, changing nothing else. Keep the same speaker: if the source says I or we, the translation says I or we, and the communication type stays the same. Output only the translation.`;
}

// Capitalised forms spelled out on purpose: no `i` flag, so "US" the country is not a pronoun.
const FIRST_PERSON =
  /\b(?:I|I'm|I'll|I've|I'd|[Mm]e|[Mm]y|[Mm]ine|[Ww]e|[Ww]e're|[Ww]e'll|[Ww]e've|[Ww]e'd|[Oo]ur|[Oo]urs|us|Us)\b/;

/**
 * Speaker guard (arm 2b): a facts retry that restores numbers by
 * re-narrating from the reader's side ("you shipped") is not accepted.
 * True when the source has no first person, or the output keeps it.
 */
export function firstPersonPreserved(input: string, output: string): boolean {
  return !FIRST_PERSON.test(input) || FIRST_PERSON.test(output);
}
