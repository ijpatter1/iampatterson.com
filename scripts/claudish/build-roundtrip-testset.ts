/**
 * Round-trip test set builder (2026-09-01, Ian's directive).
 *
 * The detector must call the translator's own cl2en output English —
 * "the site survives scrutiny" bar. This builds a frozen eval set from
 * THIS session's transcript using only excerpts verifiably ABSENT from
 * the training corpus (60-char normalized shingle check against every
 * positive chunk file), then pairs each Claudish original with its live
 * cl2en translation. Human controls ride along. Lives in the corpus
 * workspace — transcript text never enters the repo.
 *
 * Output: ~/.claudish-corpus/roundtrip-testset.jsonl
 *   {kind: 'claudish-original'|'translated-english'|'human-control', text, id}
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const SESSION_JSONL = path.join(
  homedir(),
  '.claude/projects/-Users-ipatterson-dev-iampatterson-com/2c2e7a2e-8394-4b27-9f12-28f8b5f79682.jsonl',
);
const CORPUS = path.join(homedir(), '.claudish-corpus');
const OUT = path.join(CORPUS, 'roundtrip-testset.jsonl');
const PROXY = 'https://claudish-proxy-eb4xrwmo3q-uc.a.run.app/translate';

const norm = (t: string) => t.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

function loadCorpusText(): string {
  let all = '';
  for (const f of ['chunks.jsonl', 'claudeai-chunks.jsonl']) {
    const p = path.join(CORPUS, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (!line) continue;
      try {
        const rec = JSON.parse(line) as { text?: string };
        if (rec.text) all += ' ' + norm(rec.text);
      } catch {
        /* tolerate drift */
      }
    }
  }
  return all;
}

function unseen(corpus: string, text: string): boolean {
  const n = norm(text);
  if (n.length < 80) return false;
  // Three probes across the excerpt; ANY hit = seen.
  for (const at of [0, Math.floor(n.length / 2) - 30, n.length - 60]) {
    const shingle = n.slice(Math.max(0, at), Math.max(0, at) + 60);
    if (shingle.length >= 40 && corpus.includes(shingle)) return false;
  }
  return true;
}

const ARTIFACT =
  /<local-command-stdout>|<task-notification>|<command-name>|<bash-input>|<system-reminder>|<tool-use|Caveat: The messages|This session is being continued/i;

async function translate(text: string): Promise<string | null> {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://iampatterson.com' },
    body: JSON.stringify({ text, direction: 'cl2en' }),
  });
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let out = '';
  let terminal = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (!frame.startsWith('data: ')) continue;
      const ev = JSON.parse(frame.slice(6)) as { type: string; t?: string };
      if (ev.type === 'token') out += ev.t ?? '';
      else if (ev.type !== 'meta') terminal = ev.type;
    }
  }
  return terminal === 'done' && out.length > 0 ? out : null;
}

async function main(): Promise<void> {
  const corpus = loadCorpusText();
  console.log(`corpus loaded: ${(corpus.length / 1e6).toFixed(0)}MB normalized`);
  const lines = readFileSync(SESSION_JSONL, 'utf8').split('\n');
  const assistant: string[] = [];
  const human: string[] = [];
  const seenHash = new Set<string>();
  // Late-session bias: walk from the end.
  for (let i = lines.length - 1; i >= 0 && assistant.length < 60; i--) {
    if (!lines[i]) continue;
    let rec: { type?: string; message?: { content?: unknown } };
    try {
      rec = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const content = rec.message?.content;
    if (rec.type === 'assistant' && Array.isArray(content)) {
      for (const block of content as Array<{ type?: string; text?: string }>) {
        if (block.type !== 'text' || !block.text) continue;
        // Split long messages into paragraph-ish excerpts.
        for (const para of block.text.split(/\n{2,}/)) {
          const t = para.replace(/\s+/g, ' ').trim();
          if (t.length < 300 || t.length > 1100) continue;
          if (ARTIFACT.test(t) || t.startsWith('#') || t.includes('```')) continue;
          const h = createHash('sha1').update(norm(t)).digest('hex');
          if (seenHash.has(h)) continue;
          seenHash.add(h);
          if (unseen(corpus, t)) assistant.push(t);
        }
      }
    } else if (rec.type === 'user' && typeof content === 'string' && human.length < 12) {
      const t = content.replace(/\s+/g, ' ').trim();
      if (t.length >= 200 && t.length <= 900 && !ARTIFACT.test(t) && unseen(corpus, t)) {
        human.push(t);
      }
    }
  }
  const originals = assistant.slice(0, 30);
  console.log(`unseen claudish originals: ${originals.length}, human controls: ${human.length}`);

  const rows: Array<{ kind: string; id: string; text: string }> = [];
  originals.forEach((t, i) => rows.push({ kind: 'claudish-original', id: `orig-${i}`, text: t }));
  human.forEach((t, i) => rows.push({ kind: 'human-control', id: `human-${i}`, text: t }));
  // Generic plain-prose controls (hand-written, no transcript provenance).
  const generic = [
    'The recipe was simple but the bread took two days. The starter needed feeding twice, the dough proofed overnight in the fridge, and the crumb came out open and even. The crust could have been darker. Next time the oven goes to 250 and the steam tray stays in for the first twenty minutes.',
    'We looked at three vendors last quarter. Two of them could not meet the data residency requirement and the third wanted a two year commitment. Procurement pushed back on the term and we settled on a one year deal with a renewal option. The rollout starts in March and finance signed off on Friday.',
    'My daughter started swimming lessons this month. The first two classes were rough, lots of tears at the edge of the pool, but by week three she was putting her face in the water. The instructor says another month before they try the deep end. We are keeping Saturdays free until summer.',
  ];
  generic.forEach((t, i) => rows.push({ kind: 'human-control', id: `generic-${i}`, text: t }));

  let cost = 0;
  for (const [i, orig] of originals.entries()) {
    // Pace under the proxy's 20/min per-IP limit (cached replays count too).
    if (i > 0) await new Promise((r) => setTimeout(r, 3500));
    const en = await translate(orig);
    cost += 0.0013;
    if (en) rows.push({ kind: 'translated-english', id: `trans-${i}`, text: en });
    process.stdout.write('.');
  }
  console.log(`\ntranslations done (~$${cost.toFixed(2)})`);
  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${rows.length} rows -> ${OUT}`);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
