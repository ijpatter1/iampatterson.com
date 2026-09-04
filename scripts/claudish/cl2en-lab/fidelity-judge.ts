/* cl2en lab (docs/claudish/cl2en-experiment-rules.md). Two fidelity judges, pairwise
 * against the baseline with the order swapped so position bias cancels. Judges: Claude
 * Haiku through the proxy's WIF-authenticated Anthropic client, and Gemini 3.5 Flash-Lite
 * through the proxy's Gemini adapter. Rubric frozen after calibration (section 2). */
import { readFileSync, writeFileSync } from 'node:fs';

// The SDK is a dependency of the proxy service, not of the repo root; resolve it there.
import Anthropic from '../../../infrastructure/cloud-run/claudish-proxy/node_modules/@anthropic-ai/sdk';

import { streamGemini } from '../../../infrastructure/cloud-run/claudish-proxy/src/gemini';
import { anthropicWifCredentials, readWifEnv } from '../../../infrastructure/cloud-run/claudish-proxy/src/wif';

const RUBRIC = `You are grading English translations of AI-assistant prose ("Claudish"). The goal is plain, clear English that preserves the meaning, the speaker and their stance, and the type of communication (question, request, apology, story, refusal, report). You are shown the Claudish source and two candidate translations, A and B.
Score each candidate 1 to 5 on:
- meaning: facts and claims preserved (5 = all, 1 = wrong or missing);
- speaker: first person and stance preserved (5 = fully);
- type: the communication type preserved (a question stays a question, a request a request);
- plain: a busy person would write this; no AI-assistant register, no empty emphasis (5 = plain);
- lost: 5 = nothing meaningful lost, 1 = important content dropped.
Apply this test to every clause of the source before scoring: strip the register and look at what is left. If a plain statement, act, request, question or feeling remains, that is content and it must survive in the translation. If all that remains is that something matters, is a moment, marks a shift, reflects or reveals something unnamed, or shows what comes next, the clause is register, not content: a translation that drops it loses NOTHING (do not lower its "lost" or "meaning" score for that), and a translation that keeps it, even in plain words, is less plain. Register-heavy or padded wording is never a merit. Then say which candidate is the better translation overall, or tie.
Output only JSON: {"a":{"meaning":n,"speaker":n,"type":n,"plain":n,"lost":n},"b":{"meaning":n,"speaker":n,"type":n,"plain":n,"lost":n},"preference":"a"|"b"|"tie","reason":"under 15 words"}`;

const CHECKLIST = `You are checking one English translation of a piece of AI-assistant prose ("Claudish"). Work in three steps and output only JSON.
Step 1, content inventory of the SOURCE: strip the register from every clause and list what is left as short items: each fact, claim, action, request, question, feeling, or stance a plain speaker would have said. A clause whose only content is that something matters, is a moment, marks a shift, reflects or reveals something unnamed, or shows what comes next has NO item; it is register, not content. Emphasis, framing and significance phrases produce no items.
Step 2, against the TRANSLATION: which inventory items are missing or contradicted? List them. Then list every sentence or clause of the translation that a busy person would not write in plain English: AI-assistant register, empty emphasis, padding, or a kept significance clause.
Step 3: is the speaker preserved (first person stays first person, the same stance)? Is the communication type preserved (question, request, apology, story, refusal, report)?
Output only JSON: {"items":["..."],"missing":["..."],"residue":["..."],"speakerPreserved":true|false,"typePreserved":true|false}`;

interface Checklist { items: string[]; missing: string[]; residue: string[]; speakerPreserved: boolean; typePreserved: boolean }

function checklistTurn(source: string, translation: string): string {
  return `Source (Claudish):\n<source>\n${source}\n</source>\n\nTranslation:\n<translation>\n${translation}\n</translation>`;
}

function parseChecklist(text: string): Checklist | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]) as Partial<Checklist>;
    if (!Array.isArray(v.items) || !Array.isArray(v.missing) || !Array.isArray(v.residue)) return null;
    return { items: v.items, missing: v.missing, residue: v.residue, speakerPreserved: v.speakerPreserved !== false, typePreserved: v.typePreserved !== false };
  } catch {
    return null;
  }
}

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
async function askHaiku(system: string, user: string): Promise<{ text: string; inTok: number; outTok: number }> {
  if (!anthropic) {
    const wif = readWifEnv(process.env);
    if (!wif) throw new Error('WIF env missing (run through with-lab-env.sh)');
    anthropic = new Anthropic({ credentials: anthropicWifCredentials(wif) } as unknown as ConstructorParameters<typeof Anthropic>[0]);
  }
  const res = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    // Opus 5 runs adaptive thinking by default; keep it cheap and deterministic for a judge.
    ...(CLAUDE_MODEL.startsWith('claude-haiku') ? { temperature: 0 } : { output_config: { effort: 'low' } }),
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = res.content.map((c: { type: string; text?: string }) => (c.type === 'text' ? (c.text ?? '') : '')).join('');
  return { text, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens };
}

async function askGemini(system: string, user: string): Promise<{ text: string; inTok: number; outTok: number }> {
  let text = '';
  let inTok = 0, outTok = 0;
  for await (const ev of streamGemini(
    { projectId: 'iampatterson', location: 'global', modelId: GEMINI_MODEL, maxOutputTokens: 600, thinkingBudget: 0, temperature: 0 },
    system,
    [{ role: 'user', text: user }],
    new AbortController().signal
  )) {
    if (ev.kind === 'text') text += ev.text;
    else { inTok += ev.usage.inputTokens; outTok += ev.usage.outputTokens; }
  }
  return { text, inTok, outTok };
}

const CLAUDE_MODEL = process.env.JUDGE_CLAUDE_MODEL ?? 'claude-opus-5';
const GEMINI_MODEL = process.env.JUDGE_GEMINI_MODEL ?? 'gemini-3.5-flash';
// USD per MTok (in, out): Anthropic first-party rates (claude-api skill, cached 2026-06-24);
// Vertex standard global tier for Gemini (cloud.google.com/vertex-ai/generative-ai/pricing, read 2026-09-02).
const MODEL_PRICE: Record<string, [number, number]> = {
  'claude-opus-5': [5.0, 25.0],
  'claude-sonnet-5': [2.0, 10.0],
  'claude-haiku-4-5': [1.0, 5.0],
  'gemini-3.5-flash': [1.5, 9.0],
  'gemini-3.5-flash-lite': [0.3, 2.5],
  'gemini-3.1-pro-preview': [2.0, 12.0],
};
const PRICE: Record<Judge, [number, number]> = { haiku: MODEL_PRICE[CLAUDE_MODEL] ?? [5.0, 25.0], gemini: MODEL_PRICE[GEMINI_MODEL] ?? [1.5, 9.0] };

async function main() {
  const [judge, poolPath, basePath, candPath, outPath, onlyIds] = process.argv.slice(2) as [Judge, string, string, string, string, string | undefined];
  const pool = JSON.parse(readFileSync(poolPath, 'utf8')) as Array<{ id: string; text: string }>;
  const base = new Map((JSON.parse(readFileSync(basePath, 'utf8')) as { cl2en: Array<{ id: string; out: string }> }).cl2en.map((r) => [r.id, r.out]));
  const cand = new Map((JSON.parse(readFileSync(candPath, 'utf8')) as { cl2en: Array<{ id: string; out: string }> }).cl2en.map((r) => [r.id, r.out]));
  const ids = onlyIds ? onlyIds.split(',') : pool.map((p) => p.id);
  const mode: 'pairwise' | 'checklist' = (judge as string).endsWith('-checklist') ? 'checklist' : 'pairwise';
  const judgeName = (judge as string).replace('-checklist', '') as Judge;
  const ask = judgeName === 'haiku' ? askHaiku : askGemini;
  if (mode === 'checklist') {
    // Score baseline and candidate independently; report per-output counts.
    const crows: Array<Record<string, unknown>> = [];
    let cin = 0, cout = 0;
    const agg = { baseline: { missing: 0, residue: 0, speakerLost: 0, typeLost: 0, unparsed: 0 }, candidate: { missing: 0, residue: 0, speakerLost: 0, typeLost: 0, unparsed: 0 } };
    for (const p of pool) {
      if (!ids.includes(p.id)) continue;
      const out: Record<string, unknown> = { id: p.id };
      for (const [side, text] of [['baseline', base.get(p.id) ?? ''], ['candidate', cand.get(p.id) ?? '']] as const) {
        const r = await ask(CHECKLIST, checklistTurn(p.text, text));
        cin += r.inTok; cout += r.outTok;
        const v = parseChecklist(r.text);
        out[side] = v;
        if (!v) { agg[side].unparsed++; continue; }
        agg[side].missing += v.missing.length; agg[side].residue += v.residue.length;
        if (!v.speakerPreserved) agg[side].speakerLost++;
        if (!v.typePreserved) agg[side].typeLost++;
      }
      crows.push(out);
    }
    const cost = (cin * PRICE[judgeName][0] + cout * PRICE[judgeName][1]) / 1e6;
    const summary = { judge: `${judgeName}-checklist`, model: judgeName === 'haiku' ? CLAUDE_MODEL : GEMINI_MODEL, n: crows.length, agg, inTok: cin, outTok: cout, costUsd: Number(cost.toFixed(4)) };
    console.log(JSON.stringify(summary));
    writeFileSync(outPath, JSON.stringify({ summary, rows: crows }, null, 1));
    return;
  }
  const rows: Array<Record<string, unknown>> = [];
  let inTok = 0, outTok = 0;
  const tally = { candidate: 0, baseline: 0, tie: 0, unparsed: 0 };
  const sums = { baseline: { meaning: 0, speaker: 0, type: 0, plain: 0, lost: 0 }, candidate: { meaning: 0, speaker: 0, type: 0, plain: 0, lost: 0 } };
  let scored = 0;
  for (const p of pool) {
    if (!ids.includes(p.id)) continue;
    const b = base.get(p.id) ?? '', c = cand.get(p.id) ?? '';
    // Order 1: A = baseline, B = candidate. Order 2: swapped.
    const r1 = await ask(RUBRIC, userTurn(p.text, b, c));
    const r2 = await ask(RUBRIC, userTurn(p.text, c, b));
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
  const cost = (inTok * PRICE[judgeName][0] + outTok * PRICE[judgeName][1]) / 1e6;
  const summary = { judge: judgeName, model: judgeName === 'haiku' ? CLAUDE_MODEL : GEMINI_MODEL, n: rows.length, scored, tally, meanBaseline: mean(sums.baseline), meanCandidate: mean(sums.candidate), inTok, outTok, costUsd: Number(cost.toFixed(4)) };
  console.log(JSON.stringify(summary));
  writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 1));
}
void main().catch((e) => { console.error(e instanceof Error ? `${e.constructor.name}: ${e.message}` : e); process.exit(1); });
