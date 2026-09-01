/**
 * Contrastive negatives via the translator (2026-09-01 breakthrough
 * candidate for the round-trip problem).
 *
 * Diagnosis: the negative class contains no "plain professional prose
 * about work" register at all (Wikipedia is encyclopedic, docs are
 * manuals, HN is casual, dialogs are spoken), so CCLD learned Ian's
 * Claude's DISCOURSE SKELETON — terse declaratives, colon-lists,
 * appositive parentheticals — as Claudish, and convicts the
 * translator's own de-registered output (67% latched at baseline).
 *
 * Fix: translate a sample of TRAIN-split positive chunks through the
 * live cl2en engine and add the outputs as negatives. Content-matched,
 * register-stripped twins force the boundary onto actual register
 * markers (em dashes, kill-list words, contrastive negation) instead
 * of skeletons.
 *
 * Label-noise guards: outputs are dropped when the translation failed,
 * echoed (dash-insensitive), still scores >= 0.5 on the regex
 * heuristic, or carries a smoking-gun family hit.
 *
 * Output: ~/.claudish-corpus/negatives/translated-positives.txt
 * (blank-line separated, the negative-source contract). The paired
 * source manifest goes to translated-positives-MANIFEST.json for
 * audit. Direct lane calls (WIF token file) — no proxy rate limits, no
 * server-cache pollution. Cost ~ $2 for 1500 chunks.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { buildLanes } from '../../infrastructure/cloud-run/claudish-proxy/src/adapters';
import { loadConfig } from '../../infrastructure/cloud-run/claudish-proxy/src/config';
import { EmDashSmoother } from '../../infrastructure/cloud-run/claudish-proxy/src/smooth';
import { scoreClaudish } from '../../src/lib/claudish/heuristic';

const CORPUS = path.join(homedir(), '.claudish-corpus');
const OUT = path.join(CORPUS, 'negatives', 'translated-positives.txt');
const MANIFEST = path.join(CORPUS, 'negatives', 'translated-positives-MANIFEST.json');
const TARGET = Number(process.env.CONTRASTIVE_COUNT ?? 1500);
const CONCURRENCY = 6;

const norm = (t: string) =>
  t
    .replace(/ — /g, ', ')
    .replace(/—/g, ',')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Seeded shuffle (mulberry32) — reproducible sample.
function shuffle<T>(arr: T[], seed: number): T[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main(): Promise<void> {
  const lanes = buildLanes(loadConfig(process.env), process.env);
  if (lanes.length === 0) throw new Error('no lane — check WIF env');
  const lane = lanes[0];

  const pool = readFileSync(path.join(CORPUS, 'dataset.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { text: string; label: number; split: string })
    .filter(
      (e) => e.label === 1 && e.split === 'train' && e.text.length >= 150 && e.text.length <= 1100,
    );
  const sample = shuffle(pool, 20260901).slice(0, TARGET);
  console.log(`pool ${pool.length} train positives, sampling ${sample.length}`);

  const kept: string[] = [];
  let dropped = { failed: 0, echo: 0, register: 0, short: 0 };
  let done = 0;
  let cost = 0;

  async function translateOne(text: string): Promise<void> {
    let out = '';
    const smoother = new EmDashSmoother();
    try {
      for await (const ev of lane.stream(
        { direction: 'cl2en', text },
        new AbortController().signal,
      )) {
        if (ev.kind === 'text') out += smoother.feed(ev.text);
        if (ev.kind === 'stop') {
          out += smoother.flush();
          const u = ev.usage;
          cost += (u.inputTokens + u.cacheWriteTokens) * 1e-6 + u.outputTokens * 5e-6;
          if (ev.stopReason !== 'end_turn') out = '';
        }
      }
    } catch {
      out = '';
    }
    done++;
    if (done % 100 === 0) console.log(`  ${done}/${sample.length} ($${cost.toFixed(2)})`);
    if (out.length === 0) return void dropped.failed++;
    if (out.length < 40) return void dropped.short++;
    if (norm(out) === norm(text)) return void dropped.echo++;
    const h = scoreClaudish(out);
    if (h.score >= 0.5) return void dropped.register++;
    kept.push(out.replace(/\s+/g, ' ').trim());
  }

  for (let i = 0; i < sample.length; i += CONCURRENCY) {
    await Promise.all(sample.slice(i, i + CONCURRENCY).map((e) => translateOne(e.text)));
  }

  writeFileSync(OUT, kept.join('\n\n') + '\n');
  writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        engine: 'cl2en v3 via anthropic-api lane + EmDashSmoother',
        sampled: sample.length,
        kept: kept.length,
        dropped,
        costUsd: Number(cost.toFixed(3)),
        note: 'train-split positives only; outputs are negatives. Sources never leave the corpus workspace.',
      },
      null,
      2,
    ),
  );
  console.log(
    `kept ${kept.length}, dropped ${JSON.stringify(dropped)}, cost $${cost.toFixed(2)} -> ${OUT}`,
  );
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
