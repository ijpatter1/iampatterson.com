/**
 * Claudish corpus miner — pass over ~/.claude/projects.
 *
 * Streams every transcript (main sessions + subagents), extracts
 * assistant prose via the drift-tolerant parser, strips code/paths/URLs,
 * chunks to the runtime length distribution, applies DROP rules +
 * three-stage dedup + per-session/per-project caps, and writes:
 *   ~/.claudish-corpus/chunks.jsonl     { text, sessionId, projectId }
 *   ~/.claudish-corpus/corpus-report.json  (all the launch-post numbers)
 * RAW TRANSCRIPTS NEVER ENTER THE REPO; the workspace lives outside it
 * so a .gitignore mistake cannot leak client conversations.
 *
 * Usage: npx ts-node -P tsconfig.scripts.json scripts/claudish/mine-corpus.ts \
 *          [--root DIR] [--out DIR] [--max-chunks N] [--sample N]
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

import { chunkText, seededRng } from './lib/chunk';
import { findTranscripts } from './lib/walk';
import { BoilerplateCounter, Deduper } from './lib/dedup';
import { mightBeAssistant, parseTranscriptLine } from './lib/jsonl';
import { chunkDropReason, stripStructures } from './lib/scrub';
import { TIC_PATTERNS } from './tic-patterns';

interface Args {
  root: string;
  out: string;
  maxChunks: number;
  sample: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    root: get('--root') ?? path.join(homedir(), '.claude', 'projects'),
    out: get('--out') ?? path.join(homedir(), '.claudish-corpus'),
    maxChunks: Number(get('--max-chunks') ?? Infinity),
    sample: Number(get('--sample') ?? 1),
  };
}

interface ChunkRecord {
  text: string;
  sessionId: string;
  projectId: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.out, { recursive: true });
  const denylistPath = path.join(__dirname, 'denylist.txt');
  const denylist = existsSync(denylistPath)
    ? readFileSync(denylistPath, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : [];

  const transcripts = findTranscripts(args.root).filter((_, i) => i % args.sample === 0);
  console.log(`[mine-corpus] ${transcripts.length} transcript files (sample=1/${args.sample}), denylist=${denylist.length} terms`);

  const stats = {
    files: transcripts.length,
    records: 0,
    malformed: 0,
    assistantMessages: 0,
    assistantChars: 0,
    emDashTotal: 0,
    sessions: new Set<string>(),
    projects: new Set<string>(),
    ticTotals: {} as Record<string, number>,
    ticSessions: {} as Record<string, Set<string>>,
  };
  for (const tic of TIC_PATTERNS) {
    stats.ticTotals[tic.id] = 0;
    stats.ticSessions[tic.id] = new Set();
  }

  const rng = seededRng(1337);
  const boilerplate = new BoilerplateCounter();
  const rawChunks: ChunkRecord[] = [];
  const dropCounts: Record<string, number> = { secret: 0, denylist: 0, currency: 0 };

  let fileIndex = 0;
  for (const transcript of transcripts) {
    fileIndex++;
    if (fileIndex % 200 === 0) console.log(`[mine-corpus] file ${fileIndex}/${transcripts.length}, chunks so far: ${rawChunks.length}`);
    const rl = readline.createInterface({
      input: createReadStream(transcript.file, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      stats.records++;
      if (!mightBeAssistant(line)) continue;
      const parsed = parseTranscriptLine(line);
      if (parsed.kind === 'malformed') {
        stats.malformed++;
        continue;
      }
      if (parsed.kind !== 'assistant-text') continue;
      stats.sessions.add(transcript.sessionId);
      stats.projects.add(transcript.projectId);
      for (const text of parsed.texts) {
        stats.assistantMessages++;
        stats.assistantChars += text.length;
        stats.emDashTotal += (text.match(/—/g) ?? []).length;
        for (const tic of TIC_PATTERNS) {
          const matches = text.match(tic.pattern);
          if (matches && matches.length > 0) {
            stats.ticTotals[tic.id] += matches.length;
            stats.ticSessions[tic.id].add(transcript.sessionId);
          }
        }
        const stripped = stripStructures(text);
        for (const chunk of chunkText(stripped, rng)) {
          const normalized = chunk.normalize('NFC').replace(/\s+/g, ' ').trim();
          if (normalized.length < 20) continue;
          const drop = chunkDropReason(normalized, denylist);
          if (drop) {
            dropCounts[drop]++;
            continue;
          }
          boilerplate.observe(normalized, transcript.sessionId);
          rawChunks.push({ text: normalized, sessionId: transcript.sessionId, projectId: transcript.projectId });
        }
      }
    }
    if (rawChunks.length >= args.maxChunks) break;
  }

  console.log(`[mine-corpus] raw chunks: ${rawChunks.length}; filtering (boilerplate, dedup, caps)...`);
  const deduper = new Deduper();
  const perSession = new Map<string, number>();
  const perProject = new Map<string, number>();
  const kept: ChunkRecord[] = [];
  let boilerplateDropped = 0;
  let dupDropped = 0;
  let capDropped = 0;
  // Caps are BALANCE controls, sized to the corpus actually present:
  // this corpus retains few parent sessions (each huge, with hundreds of
  // subagent transcripts inheriting its id), so fixed small caps would
  // throttle the whole dataset. No session gets more than ~2x the mean;
  // no project more than ~15%.
  const sessionCount = new Set(rawChunks.map((c) => c.sessionId)).size;
  const sessionCap = Math.max(200, Math.ceil((rawChunks.length / Math.max(1, sessionCount)) * 2));
  const projectCap = Math.max(1000, Math.floor(rawChunks.length * 0.15));
  for (const chunk of rawChunks) {
    if (boilerplate.isBoilerplate(chunk.text)) {
      boilerplateDropped++;
      continue;
    }
    if (!deduper.add(chunk.text)) {
      dupDropped++;
      continue;
    }
    if (
      (perSession.get(chunk.sessionId) ?? 0) >= sessionCap ||
      (perProject.get(chunk.projectId) ?? 0) >= projectCap
    ) {
      capDropped++;
      continue;
    }
    perSession.set(chunk.sessionId, (perSession.get(chunk.sessionId) ?? 0) + 1);
    perProject.set(chunk.projectId, (perProject.get(chunk.projectId) ?? 0) + 1);
    kept.push(chunk);
  }

  writeFileSync(
    path.join(args.out, 'chunks.jsonl'),
    kept.map((c) => JSON.stringify(c)).join('\n') + '\n'
  );

  const per10k = (n: number) => Math.round((n / Math.max(1, stats.assistantChars)) * 10000 * 100) / 100;
  const report = {
    generatedAt: new Date().toISOString(),
    root: args.root,
    files: stats.files,
    records: stats.records,
    malformedLines: stats.malformed,
    sessions: stats.sessions.size,
    projects: stats.projects.size,
    assistantMessages: stats.assistantMessages,
    assistantChars: stats.assistantChars,
    emDash: {
      total: stats.emDashTotal,
      per10kChars: per10k(stats.emDashTotal),
      perMessage: Math.round((stats.emDashTotal / Math.max(1, stats.assistantMessages)) * 100) / 100,
    },
    tics: Object.fromEntries(
      TIC_PATTERNS.map((tic) => [
        tic.id,
        {
          label: tic.label,
          total: stats.ticTotals[tic.id],
          per10kChars: per10k(stats.ticTotals[tic.id]),
          sessionsWith: stats.ticSessions[tic.id].size,
          sessionShare:
            Math.round((stats.ticSessions[tic.id].size / Math.max(1, stats.sessions.size)) * 1000) / 1000,
        },
      ])
    ),
    chunks: {
      raw: rawChunks.length,
      kept: kept.length,
      droppedByScrub: dropCounts,
      droppedBoilerplate: boilerplateDropped,
      droppedDuplicates: dupDropped,
      droppedByCaps: capDropped,
      perSessionCap: sessionCap,
      perProjectCap: projectCap,
    },
  };
  writeFileSync(path.join(args.out, 'corpus-report.json'), JSON.stringify(report, null, 2));
  console.log(`[mine-corpus] kept ${kept.length} chunks from ${stats.sessions.size} sessions across ${stats.projects.size} projects`);
  console.log(`[mine-corpus] report: ${path.join(args.out, 'corpus-report.json')}`);
}

void main();
