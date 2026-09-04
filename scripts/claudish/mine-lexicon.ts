/**
 * Claudish corpus miner — lexicon candidate generator.
 *
 * Track A (seeded): counts every tic pattern over the kept chunks and
 * attaches up to 5 short scrubbed example sentences per tic — ALL
 * marked reviewed:false. Ian prunes candidates and flips reviewed:true
 * on what ships; the committed lexicon's Jest test enforces that no
 * unreviewed text ever lands in the repo.
 *
 * Track B (discovery, log-odds with informative Dirichlet prior against
 * the negative corpus) runs only when --negatives points at a directory
 * of plain-text negatives; skipped otherwise (C1 fetches them).
 *
 * Output: ~/.claudish-corpus/lexicon.candidates.json (outside the repo).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { TIC_PATTERNS } from './tic-patterns';

interface Chunk {
  text: string;
  sessionId: string;
  projectId: string;
}

interface Args {
  corpus: string;
  negatives?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    corpus: get('--corpus') ?? path.join(homedir(), '.claudish-corpus'),
    negatives: get('--negatives'),
  };
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 240);
}

const WORD = /[a-z][a-z'-]+/g;

function wordCounts(texts: Iterable<string>, maxN: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const words = (text.toLowerCase().match(WORD) ?? []).filter((w) => w.length > 2);
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n).join(' ');
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** Monroe/Colaresi/Quinn log-odds with an informative Dirichlet prior. */
function logOdds(
  positive: Map<string, number>,
  negative: Map<string, number>,
  minCount: number
): Array<{ gram: string; z: number; count: number }> {
  const prior = new Map<string, number>();
  let priorTotal = 0;
  for (const [gram, count] of positive) {
    prior.set(gram, (prior.get(gram) ?? 0) + count);
    priorTotal += count;
  }
  for (const [gram, count] of negative) {
    prior.set(gram, (prior.get(gram) ?? 0) + count);
    priorTotal += count;
  }
  const posTotal = [...positive.values()].reduce((a, b) => a + b, 0);
  const negTotal = [...negative.values()].reduce((a, b) => a + b, 0);
  const alpha0 = 500; // prior strength
  const results: Array<{ gram: string; z: number; count: number }> = [];
  for (const [gram, posCount] of positive) {
    if (posCount < minCount) continue;
    const negCount = negative.get(gram) ?? 0;
    const alpha = ((prior.get(gram) ?? 0) / priorTotal) * alpha0;
    const l1 = Math.log((posCount + alpha) / (posTotal + alpha0 - posCount - alpha));
    const l2 = Math.log((negCount + alpha) / (negTotal + alpha0 - negCount - alpha));
    const variance = 1 / (posCount + alpha) + 1 / (negCount + alpha);
    results.push({ gram, z: (l1 - l2) / Math.sqrt(variance), count: posCount });
  }
  return results.sort((a, b) => b.z - a.z);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const chunks: Chunk[] = readFileSync(path.join(args.corpus, 'chunks.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Chunk);
  const report = JSON.parse(
    readFileSync(path.join(args.corpus, 'corpus-report.json'), 'utf8')
  ) as Record<string, unknown>;

  console.log(`[mine-lexicon] ${chunks.length} chunks`);

  // Track A: per-tic counts + example sentences from the scrubbed chunks.
  const tics = TIC_PATTERNS.map((tic) => {
    const sessions = new Set<string>();
    const examples: string[] = [];
    let total = 0;
    for (const chunk of chunks) {
      const matches = chunk.text.match(tic.pattern);
      if (!matches || matches.length === 0) continue;
      total += matches.length;
      sessions.add(chunk.sessionId);
      if (examples.length < 5) {
        const sentence = sentencesOf(chunk.text).find((s) => tic.pattern.test(s));
        tic.pattern.lastIndex = 0;
        if (sentence && !examples.includes(sentence)) examples.push(sentence);
      }
      tic.pattern.lastIndex = 0;
    }
    return {
      id: tic.id,
      label: tic.label,
      kind: 'pattern',
      pattern: tic.pattern.source,
      chunkTotal: total,
      sessionsWith: sessions.size,
      examples,
      shipInFewShots: false,
      reviewed: false,
    };
  }).sort((a, b) => b.chunkTotal - a.chunkTotal);

  // Track B: log-odds discovery, only with a negative corpus present.
  let discovered: Array<{ gram: string; z: number; count: number }> = [];
  if (args.negatives && existsSync(args.negatives)) {
    const negTexts: string[] = [];
    for (const file of readdirSync(args.negatives)) {
      if (file.endsWith('.txt')) {
        negTexts.push(readFileSync(path.join(args.negatives, file), 'utf8'));
      }
    }
    console.log(`[mine-lexicon] Track B against ${negTexts.length} negative files`);
    const positive = wordCounts(chunks.map((c) => c.text), 3);
    const negative = wordCounts(negTexts, 3);
    discovered = logOdds(positive, negative, 50).slice(0, 300);
  } else {
    console.log('[mine-lexicon] Track B skipped (no --negatives dir yet)');
  }

  const candidates = {
    generatedAt: new Date().toISOString(),
    reviewedBy: null,
    corpus: {
      sessions: report.sessions,
      projects: report.projects,
      files: report.files,
      assistantMessages: report.assistantMessages,
      assistantChars: report.assistantChars,
      chunksKept: chunks.length,
    },
    stats: {
      emDash: report.emDash,
      tics: report.tics,
    },
    tics,
    discovered,
    fewShots: [] as unknown[],
    instructions:
      'HAND-REVIEW GATE: prune tics, trim examples to ones you would ship, set shipInFewShots/reviewed per item, hand-write fewShots pairs. The curated result is committed as src/lib/claudish/lexicon.json; its Jest test refuses unreviewed entries.',
  };
  const outPath = path.join(args.corpus, 'lexicon.candidates.json');
  writeFileSync(outPath, JSON.stringify(candidates, null, 2));
  console.log(`[mine-lexicon] candidates: ${outPath}`);
  console.log(`[mine-lexicon] top tics by chunk total:`);
  for (const tic of tics.slice(0, 8)) {
    console.log(`  ${tic.id}: ${tic.chunkTotal} (${tic.sessionsWith} sessions, ${tic.examples.length} examples)`);
  }
}

main();
