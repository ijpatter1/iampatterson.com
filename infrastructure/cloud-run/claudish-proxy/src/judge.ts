/**
 * claudish-proxy — the translation-loop judge.
 *
 * Ensemble no single model can cheat: the MEDIAN of three independently
 * trained content-sensitive CCLD models (r3, r6h, r7d — vendored in
 * src/vendor/), max-ed with the regex heuristic so the meme door and
 * mechanical register evidence always count. Pass = product < 0.5
 * ("Leaning English" or better in the UI's tiers).
 *
 * Also provides sentence-level attribution and the negation-feedback
 * builder for retry turns (the loop design agreed with Ian 2026-09-01:
 * conversation-shaped retries carrying machine-generated, specific
 * negations).
 */
import { killListHits } from './assertions';
import { loadJudgeModel } from './judge-loader';
import { extractRegisterFeatures } from './vendor/ccld-featurizer';
import { scoreClaudish } from './vendor/heuristic';
import { R3_WEIGHTS, R6H_WEIGHTS, R7D_WEIGHTS } from './vendor/judge-weights';

import type { HeuristicResult } from './vendor/heuristic';

const MODELS = [R3_WEIGHTS, R6H_WEIGHTS, R7D_WEIGHTS].map((w, i) => {
  const m = loadJudgeModel(w);
  if (!m) throw new Error(`judge model ${i} refused to load`);
  return m;
});

export const JUDGE_PASS_BELOW = 0.5;

export interface JudgeVerdict {
  /** max(median of the three models, heuristic score). */
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

export function judgeTranslation(text: string): JudgeVerdict {
  const ps = MODELS.map((m) => m.predict(text)).sort((a, b) => a - b);
  const heuristic = scoreClaudish(text);
  const p = Math.max(ps[1], heuristic.score);
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
export function buildNegationFeedback(output: string, verdict: JudgeVerdict): string {
  const kills = killListHits(output);
  const worst = convictingSentences(output, 2);
  const parts = [
    'That still reads as AI-assistant prose. Rewrite it as genuinely plain English.',
  ];
  if (kills.length > 0) parts.push(`Remove these words entirely: ${kills.join(', ')}.`);
  if (verdict.heuristic.signals.length > 0) {
    parts.push(`Detected patterns to eliminate: ${verdict.heuristic.signals.join(', ')}.`);
  }
  if (worst.length > 0) {
    parts.push(
      'These sentences are the problem. Restructure them onto human subjects, merge related thoughts, or cut empty emphasis:'
    );
    for (const sentence of worst) parts.push(`- "${sentence}"`);
  }
  parts.push(
    'Keep all facts, identifiers, and numbers exactly. Output only the rewritten translation.'
  );
  return parts.join('\n');
}
