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

export function structuralEvidence(text: string, verdict: JudgeVerdict): StructuralEvidence {
  if (verdict.p < STRUCTURAL_RETRY_AT) return { convicting: [], actionable: false };
  const convicting = convictingSentences(text, 4);
  return { convicting, actionable: convicting.length >= STRUCTURAL_MIN_SENTENCES };
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
      'These sentences are the problem. Do not repair them — RE-COMPOSE the whole text from scratch, as one person telling another what happened, in your own plain sentence shapes. Front the actor and the time ("Six weeks ago we launched..."), never the abstraction ("The complaint, six weeks in, is..."). Framing sentences ("What follows is...") become direct ones ("Here is..."):'
    );
    for (const sentence of worst) parts.push(`- "${sentence}"`);
  }
  parts.push(
    'Keep all facts, identifiers, and numbers exactly. Output only the rewritten translation.'
  );
  return parts.join('\n');
}
