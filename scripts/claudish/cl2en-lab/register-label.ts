/**
 * Loop 3 register labeller (2026-09-02). A frozen frontier judge scores corpus
 * chunks 0-4 for how strongly they carry the Claudish REGISTER, independent of
 * topic and authorship. Labels are on corpus chunks only, never on translator
 * output. Input: ~/.claudish-corpus/labels/sample.jsonl {id, stratum, source,
 * text}. Output: labels-<judge>.jsonl {id, stratum, source, score, judge,
 * model} (no text). Resumable: already-labelled ids are skipped. Cost goes to
 * the loop-3 ledger. No chunk text is ever logged.
 *
 * Usage (through with-lab-env.sh): LABEL_JUDGE=gemini|claude [LABEL_LIMIT=n] [LABEL_SAMPLE=<file>]
 *   [LABEL_CONCURRENCY=4] npx ts-node -P tsconfig.scripts.json scripts/claudish/cl2en-lab/register-label.ts
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import Anthropic from '../../../infrastructure/cloud-run/claudish-proxy/node_modules/@anthropic-ai/sdk';
import { streamGemini } from '../../../infrastructure/cloud-run/claudish-proxy/src/gemini';
import { anthropicWifCredentials, readWifEnv } from '../../../infrastructure/cloud-run/claudish-proxy/src/wif';

export const RUBRIC = `You are scoring short passages for how strongly they carry a particular prose register: the recognisable house style of Claude, an AI assistant. Score the REGISTER only. The topic, whether the passage is correct, whether it is about code, and whether an AI or a person wrote it are NOT the question: a person can write in this register and Claude can write plainly.

Marks of the register (any of these, in any mix):
- contrastive negation used for emphasis: "this isn't X, it's Y", "not just X but Y", "less a bug than a symptom";
- spaced em dashes used as rhetorical hinges, and colon-led reveals;
- a consequence clause that summarises significance: "which means", "this matters because", "the upshot is";
- reflexive validation and framing: "you're absolutely right", "great question", "to be clear", "here's the thing";
- polished tidy structure: bold-led bullets, a restated takeaway at the end, the neat triad;
- hedged omniscience: "it's worth noting", "importantly", "robust", "seamless", "comprehensive", "delve", "landscape", "testament";
- the reassuring closer: "let me know if you'd like me to...", "happy to...".

Scale:
0 = no trace of the register: plain speech or writing as an ordinary person would produce it.
1 = a stray tic in otherwise plain text.
2 = noticeably present: two or three marks, but the passage still reads mostly plain.
3 = clearly the register: the marks shape the sentences.
4 = unmistakable: dense, the register is the whole texture.

You will get numbered passages. Reply with JSON only: {"scores":[{"id":"<id>","score":<0-4>}, ...]} covering every id once. No commentary.`;

type Row = { id: string; stratum: string; source: string; text: string };
const C = path.join(homedir(), '.claudish-corpus');
const D = process.env.CL2EN_LAB_DIR ?? path.join(C, 'analysis', '2026-09-01-model-compare');
const JUDGE = (process.env.LABEL_JUDGE ?? 'gemini') as 'gemini' | 'claude';
const MODEL = process.env.LABEL_MODEL ?? (JUDGE === 'gemini' ? 'gemini-3.1-pro-preview' : 'claude-opus-5');
const PRICE: Record<string, [number, number]> = { 'claude-opus-5': [5.0, 25.0], 'gemini-3.1-pro-preview': [2.0, 12.0], 'gemini-3.5-flash': [1.5, 9.0], 'gemini-3.5-flash-lite': [0.3, 2.5] };
const BATCH = 10;
const OUT = path.join(C, 'labels', `labels-${JUDGE}.jsonl`);

let anthropic: Anthropic | null = null;
async function ask(user: string): Promise<{ text: string; inTok: number; outTok: number }> {
  if (JUDGE === 'claude') {
    if (!anthropic) {
      const wif = readWifEnv(process.env);
      if (!wif) throw new Error('WIF env missing (run through with-lab-env.sh)');
      anthropic = new Anthropic({ credentials: anthropicWifCredentials(wif) } as unknown as ConstructorParameters<typeof Anthropic>[0]);
    }
    const res = await anthropic.messages.create({ model: MODEL, max_tokens: 600, output_config: { effort: 'low' }, system: RUBRIC, messages: [{ role: 'user', content: user }] } as Parameters<typeof anthropic.messages.create>[0]);
    const r = res as { content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } };
    return { text: r.content.map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join(''), inTok: r.usage.input_tokens, outTok: r.usage.output_tokens };
  }
  let text = ''; let inTok = 0; let outTok = 0;
  for await (const ev of streamGemini({ projectId: 'iampatterson', location: 'global', modelId: MODEL, maxOutputTokens: 600, thinkingBudget: 0, temperature: 0 }, RUBRIC, [{ role: 'user', text: user }], new AbortController().signal)) {
    if (ev.kind === 'text') text += ev.text;
    else { inTok += ev.usage.inputTokens; outTok += ev.usage.outputTokens; }
  }
  return { text, inTok, outTok };
}

function parseScores(text: string): Map<string, number> | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]) as { scores?: Array<{ id: string; score: number }> };
    if (!Array.isArray(v.scores)) return null;
    const out = new Map<string, number>();
    for (const s of v.scores) if (typeof s.id === 'string' && Number.isInteger(s.score) && s.score >= 0 && s.score <= 4) out.set(s.id, s.score);
    return out;
  } catch { return null; }
}

async function main(): Promise<void> {
  const rows = readFileSync(process.env.LABEL_SAMPLE ?? path.join(C, 'labels', 'sample.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row);
  const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => (JSON.parse(l) as { id: string }).id) : []);
  const limit = Number(process.env.LABEL_LIMIT ?? Infinity);
  const todo = rows.filter((r) => !done.has(r.id)).slice(0, limit);
  const batches: Row[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  console.log(`judge=${JUDGE} model=${MODEL} already=${done.size} todo=${todo.length} batches=${batches.length}`);
  let inTok = 0, outTok = 0, scored = 0, unparsed = 0, calls = 0;
  const conc = Number(process.env.LABEL_CONCURRENCY ?? 4);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < batches.length) {
      const batch = batches[next++];
      const user = batch.map((r, i) => `[${i + 1}] id=${r.id}\n${r.text}`).join('\n\n');
      let scores: Map<string, number> | null = null;
      for (let attempt = 0; attempt < 2 && !scores; attempt++) {
        try {
          const res = await ask(user); calls++; inTok += res.inTok; outTok += res.outTok;
          scores = parseScores(res.text);
        } catch (e) { console.error(`call failed: ${(e as Error).constructor.name}`); await new Promise((r) => setTimeout(r, 2000)); }
      }
      if (!scores) { unparsed += batch.length; continue; }
      for (const r of batch) {
        const s = scores.get(r.id);
        if (s === undefined) { unparsed++; continue; }
        appendFileSync(OUT, JSON.stringify({ id: r.id, stratum: r.stratum, source: r.source, score: s, judge: JUDGE, model: MODEL }) + '\n'); scored++;
      }
      if (calls % 50 === 0) console.log(`  calls=${calls} scored=${scored} unparsed=${unparsed}`);
    }
  }
  await Promise.all(Array.from({ length: conc }, () => worker()));
  const [pin, pout] = PRICE[MODEL] ?? [5, 25];
  const cost = (inTok * pin + outTok * pout) / 1e6;
  appendFileSync(path.join(D, 'loop3-ledger.jsonl'), JSON.stringify({ run: `label-${JUDGE}-${MODEL}`, scored, unparsed, inTok, outTok, costUsd: Math.round(cost * 1e4) / 1e4 }) + '\n');
  console.log(`scored=${scored} unparsed=${unparsed} calls=${calls} inTok=${inTok} outTok=${outTok} cost=$${cost.toFixed(4)} -> ${OUT}`);
}
void main();
