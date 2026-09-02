/* cl2en lab (docs/claudish/cl2en-experiment-rules.md). Two fidelity judges, pairwise
 * against the baseline with the order swapped so position bias cancels. Judges: Claude
 * Haiku through the proxy's WIF-authenticated Anthropic client, and Gemini 3.5 Flash-Lite
 * through the proxy's Gemini adapter. Rubric frozen after calibration (section 2). */
import { readFileSync, writeFileSync } from 'node:fs';

import Anthropic from '@anthropic-ai/sdk';

import { streamGemini } from '../../../infrastructure/cloud-run/claudish-proxy/src/gemini';
import { anthropicWifCredentials, readWifEnv } from '../../../infrastructure/cloud-run/claudish-proxy/src/wif';

const RUBRIC = `You are grading English translations of AI-assistant prose ("Claudish"). The goal is plain, clear English that preserves the meaning, the speaker and their stance, and the type of communication (question, request, apology, story, refusal, report). You are shown the Claudish source and two candidate translations, A and B.
Score each candidate 1 to 5 on:
- meaning: facts and claims preserved (5 = all, 1 = wrong or missing);
- speaker: first person and stance preserved (5 = fully);
- type: the communication type preserved (a question stays a question, a request a request);
- plain: a busy person would write this; no AI-assistant register, no empty emphasis (5 = plain);
- lost: 5 = nothing meaningful lost, 1 = important content dropped.
Register-heavy or padded wording is never a merit. Emphasis that states no fact should be gone, not reworded. Then say which candidate is the better translation overall, or tie.
Output only JSON: {"a":{"meaning":n,"speaker":n,"type":n,"plain":n,"lost":n},"b":{"meaning":n,"speaker":n,"type":n,"plain":n,"lost":n},"preference":"a"|"b"|"tie","reason":"under 15 words"}`;

interface Scores { meaning: number; speaker: number; type: number; plain: number; lost: number }
interface Verdict { a: Scores; b: Scores; preference: 'a' | 'b' | 'tie'; reason?: string }
type Judge = 'haiku' | 'gemini';

function userTurn(source: string, a: string, b: string): string {
  return `Claudish source:\n<source>\n${source}\n</source>\n\nCandidate A:\n<a>\n${a}\n</a>\n\nCandidate B:\n<b>\n${b}\n</b>`;
}

function parseVerdict(text: string): Verdict | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]) as Verdict;
    if (!v.a || !v.b || !['a', 'b', 'tie'].includes(v.preference)) return null;
    return v;
  } catch {
    return null;
  }
}

let anthropic: Anthropic | null = null;
async function askHaiku(source: string, a: string, b: string): Promise<{ text: string; inTok: number; outTok: number }> {
  if (!anthropic) {
    const wif = readWifEnv(process.env);
    if (!wif) throw new Error('WIF env missing (run through with-lab-env.sh)');
    anthropic = new Anthropic({ credentials: anthropicWifCredentials(wif) } as unknown as ConstructorParameters<typeof Anthropic>[0]);
  }
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    temperature: 0,
    system: RUBRIC,
    messages: [{ role: 'user', content: userTurn(source, a, b) }],
  });
  const text = res.content.map((c) => ('text' in c ? c.text : '')).join('');
  return { text, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens };
}

async function askGemini(source: string, a: string, b: string): Promise<{ text: string; inTok: number; outTok: number }> {
  let text = '';
  let inTok = 0, outTok = 0;
  for await (const ev of streamGemini(
    { projectId: 'iampatterson', location: process.env.GEMINI_LOCATION ?? 'global', modelId: process.env.GEMINI_MODEL_ID ?? 'gemini-3.5-flash-lite', maxOutputTokens: 300, thinkingBudget: 0, temperature: 0 },
    RUBRIC,
    [{ role: 'user', text: userTurn(source, a, b) }],
    new AbortController().signal
  )) {
    if (ev.kind === 'text') text += ev.text;
    else { inTok += ev.usage.inputTokens; outTok += ev.usage.outputTokens; }
  }
  return { text, inTok, outTok };
}

const PRICE: Record<Judge, [number, number]> = { haiku: [1.0, 5.0], gemini: [0.3, 2.5] };

async function main() {
  const [judge, poolPath, basePath, candPath, outPath, onlyIds] = process.argv.slice(2) as [Judge, string, string, string, string, string | undefined];
  const pool = JSON.parse(readFileSync(poolPath, 'utf8')) as Array<{ id: string; text: string }>;
  const base = new Map((JSON.parse(readFileSync(basePath, 'utf8')) as { cl2en: Array<{ id: string; out: string }> }).cl2en.map((r) => [r.id, r.out]));
  const cand = new Map((JSON.parse(readFileSync(candPath, 'utf8')) as { cl2en: Array<{ id: string; out: string }> }).cl2en.map((r) => [r.id, r.out]));
  const ids = onlyIds ? onlyIds.split(',') : pool.map((p) => p.id);
  const ask = judge === 'haiku' ? askHaiku : askGemini;
  const rows: Array<Record<string, unknown>> = [];
  let inTok = 0, outTok = 0;
  const tally = { candidate: 0, baseline: 0, tie: 0, unparsed: 0 };
  const sums = { baseline: { meaning: 0, speaker: 0, type: 0, plain: 0, lost: 0 }, candidate: { meaning: 0, speaker: 0, type: 0, plain: 0, lost: 0 } };
  let scored = 0;
  for (const p of pool) {
    if (!ids.includes(p.id)) continue;
    const b = base.get(p.id) ?? '', c = cand.get(p.id) ?? '';
    // Order 1: A = baseline, B = candidate. Order 2: swapped.
    const r1 = await ask(p.text, b, c);
    const r2 = await ask(p.text, c, b);
    inTok += r1.inTok + r2.inTok; outTok += r1.outTok + r2.outTok;
    const v1 = parseVerdict(r1.text), v2 = parseVerdict(r2.text);
    let pref: 'candidate' | 'baseline' | 'tie' | 'unparsed' = 'unparsed';
    if (v1 && v2) {
      const p1 = v1.preference === 'b' ? 'candidate' : v1.preference === 'a' ? 'baseline' : 'tie';
      const p2 = v2.preference === 'a' ? 'candidate' : v2.preference === 'b' ? 'baseline' : 'tie';
      pref = p1 === p2 ? p1 : 'tie'; // disagreement across orders = position bias = tie
      for (const k of Object.keys(sums.baseline) as Array<keyof Scores>) {
        sums.baseline[k] += (v1.a[k] + v2.b[k]) / 2;
        sums.candidate[k] += (v1.b[k] + v2.a[k]) / 2;
      }
      scored++;
    }
    tally[pref]++;
    rows.push({ id: p.id, preference: pref, order1: v1, order2: v2 });
  }
  const mean = (s: Scores) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number((v / Math.max(1, scored)).toFixed(2))]));
  const cost = (inTok * PRICE[judge][0] + outTok * PRICE[judge][1]) / 1e6;
  const summary = { judge, n: rows.length, scored, tally, meanBaseline: mean(sums.baseline), meanCandidate: mean(sums.candidate), inTok, outTok, costUsd: Number(cost.toFixed(4)) };
  console.log(JSON.stringify(summary));
  writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 1));
}
void main().catch((e) => { console.error(e instanceof Error ? `${e.constructor.name}: ${e.message}` : e); process.exit(1); });
