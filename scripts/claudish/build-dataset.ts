/**
 * Claudish CCLD — training dataset builder.
 *
 * Positives: the mined chunk store (grouped by parent session).
 * Negatives: every negatives/*.txt, run through the SAME strip + chunk
 * pipeline, grouped by source file + block (never by chunk — leakage).
 * Human turns are capped at 10% of the negative class (their filter is
 * heuristic-circular; disclosed). Classes balanced by downsampling the
 * larger (seeded). Splits: 80/10/10 by group hash, plus a harder
 * project-held-out flag on positives from 3 held-out projects — with
 * only ~22 parent sessions, the project split is the honest
 * generalization number and the model card reports it separately.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { chunkText, seededRng } from './lib/chunk';
import { chunkDropReason } from './lib/scrub';
import { stripStructures } from './lib/scrub';
import { fnv1a32 } from '../../src/lib/claudish/ccld-featurizer';

interface Example {
  text: string;
  label: 0 | 1;
  group: string;
  source: string;
  split: 'train' | 'dev' | 'test';
  heldOutProject?: boolean;
}

const HUMAN_TURNS_CAP_FRACTION = 0.1;

function splitOf(group: string): 'train' | 'dev' | 'test' {
  const h = fnv1a32(`split:${group}`) % 10;
  if (h === 8) return 'dev';
  if (h === 9) return 'test';
  return 'train';
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function main(): void {
  const corpusDir = path.join(homedir(), '.claudish-corpus');
  const rng = seededRng(20260831);

  // Positives.
  const positives: Example[] = [];
  const projects = new Set<string>();
  for (const line of readFileSync(path.join(corpusDir, 'chunks.jsonl'), 'utf8').split('\n')) {
    if (!line) continue;
    const c = JSON.parse(line) as { text: string; sessionId: string; projectId: string };
    projects.add(c.projectId);
    positives.push({
      text: c.text,
      label: 1,
      group: `pos:${c.sessionId}`,
      source: c.projectId,
      split: splitOf(`pos:${c.sessionId}`),
    });
  }
  // Project-held-out: ~3 of the projects by hash, marked on top of splits.
  const held = new Set(
    [...projects].filter((p) => fnv1a32(`held:${p}`) % Math.ceil(projects.size / 3) === 0).slice(0, 3)
  );
  for (const ex of positives) {
    if (held.has(ex.source)) ex.heldOutProject = true;
  }

  // Negatives.
  const negDir = path.join(corpusDir, 'negatives');
  let negatives: Example[] = [];
  let humanTurns: Example[] = [];
  for (const file of readdirSync(negDir)) {
    if (!file.endsWith('.txt')) continue;
    const source = file.replace(/\.txt$/, '');
    const blocks = readFileSync(path.join(negDir, file), 'utf8').split(/\n\n+/);
    const bucket: Example[] = [];
    blocks.forEach((block, index) => {
      const stripped = stripStructures(block);
      for (const chunk of chunkText(stripped, rng)) {
        const normalized = chunk.normalize('NFC').replace(/\s+/g, ' ').trim();
        if (normalized.length < 20) continue;
        if (chunkDropReason(normalized)) continue;
        const group = `neg:${source}:${Math.floor(index / 40)}`;
        bucket.push({
          text: normalized,
          label: 0,
          group,
          source,
          split: splitOf(group),
        });
      }
    });
    if (source === 'human-turns') humanTurns = bucket;
    else negatives.push(...bucket);
  }
  // Cap the circular source at 10% of the negative class.
  const humanCap = Math.floor((negatives.length / (1 - HUMAN_TURNS_CAP_FRACTION)) * HUMAN_TURNS_CAP_FRACTION);
  negatives = negatives.concat(shuffle(humanTurns, rng).slice(0, humanCap));

  // Balance 50/50 by downsampling the larger class (train split only —
  // dev/test keep everything for stable evaluation).
  const posTrain = positives.filter((e) => e.split === 'train' && !e.heldOutProject);
  const negTrain = negatives.filter((e) => e.split === 'train');
  const trainSize = Math.min(posTrain.length, negTrain.length);
  const train = shuffle(
    shuffle(posTrain, rng).slice(0, trainSize).concat(shuffle(negTrain, rng).slice(0, trainSize)),
    rng
  );
  const evalSet = positives
    .filter((e) => e.split !== 'train' || e.heldOutProject)
    .concat(negatives.filter((e) => e.split !== 'train'));

  const all = train.concat(evalSet);
  writeFileSync(
    path.join(corpusDir, 'dataset.jsonl'),
    all.map((e) => JSON.stringify(e)).join('\n') + '\n'
  );
  const count = (label: 0 | 1, split: string) =>
    all.filter((e) => e.label === label && e.split === split && !e.heldOutProject).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    positivesTotal: positives.length,
    negativesTotal: negatives.length,
    humanTurnsKept: Math.min(humanCap, humanTurns.length),
    heldOutProjects: [...held],
    heldOutPositives: positives.filter((e) => e.heldOutProject).length,
    train: { pos: count(1, 'train'), neg: count(0, 'train') },
    dev: { pos: count(1, 'dev'), neg: count(0, 'dev') },
    test: { pos: count(1, 'test'), neg: count(0, 'test') },
    negBySource: Object.fromEntries(
      [...new Set(negatives.map((e) => e.source))].map((s) => [
        s,
        negatives.filter((e) => e.source === s).length,
      ])
    ),
  };
  writeFileSync(path.join(corpusDir, 'dataset-summary.json'), JSON.stringify(summary, null, 2));
  console.log('[build-dataset]', JSON.stringify(summary.train), 'dev', JSON.stringify(summary.dev), 'test', JSON.stringify(summary.test));
  console.log('[build-dataset] held-out projects:', [...held].join(', '), `(${summary.heldOutPositives} chunks)`);
  console.log('[build-dataset] neg by source:', JSON.stringify(summary.negBySource));
}

main();
