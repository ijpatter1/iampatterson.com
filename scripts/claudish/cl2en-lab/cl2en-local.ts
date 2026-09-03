import path from "node:path";
import { homedir } from "node:os";
/* cl2en lab (docs/claudish/cl2en-experiment-rules.md). Paths come from CL2EN_LAB_DIR; raw pool text never enters the repo. */
/**
 * Local cl2en battery: drives the real refinement loop (runCl2enLoop over
 * streamGemini) on the deployed battery's six Claudish inputs, for a
 * model/location taken from env. Reports served judge score, attempts
 * trajectory, revise, wall time, and usage. Same scoring as battery.ts.
 * Usage: GEMINI_MODEL_ID=... GEMINI_LOCATION=... GEMINI_ACCESS_TOKEN=... ts-node cl2en-local.ts out.json
 */
import { readFileSync, writeFileSync } from "node:fs";

import {
  loopBudgetFor,
  runCl2enLoop,
} from "../../../infrastructure/cloud-run/claudish-proxy/src/cl2en-loop";
import { streamGemini } from "../../../infrastructure/cloud-run/claudish-proxy/src/gemini";
import { buildSystem } from "../../../infrastructure/cloud-run/claudish-proxy/src/prompts";
import { judgeAxes, setJudgeModels, setJudgeRule } from "../../../infrastructure/cloud-run/claudish-proxy/src/judge";
import { EmDashSmoother, MarkerStripper } from "../../../infrastructure/cloud-run/claudish-proxy/src/smooth";
const smoothForJudge = (raw: string): string => { const st = new MarkerStripper(); const sm = new EmDashSmoother(); return sm.feed(st.feed(raw)) + sm.feed(st.flush()) + sm.flush(); };

// Loop-2 T arms: LOOP_JUDGE_MODELS=tag,tag,tag swaps the loop's judge
// ensemble for registry candidates (~/.claudish-corpus/models/<tag>).
if (process.env.LOOP_JUDGE_MODELS) {
  const tags = process.env.LOOP_JUDGE_MODELS.split(",").map((x) => x.trim()).filter(Boolean);
  setJudgeModels(
    tags.map((tag) => JSON.parse(readFileSync(path.join(homedir(), ".claudish-corpus", "models", tag, "ccld-weights.json"), "utf8")) as unknown)
  );
  console.log(`judge ensemble overridden: ${tags.join(", ")}`);
}
if (process.env.LOOP_JUDGE_RULE === "max") {
  setJudgeRule("max");
  console.log("judge rule: max (strict; every member must pass)");
}

const DIR = (process.env.CL2EN_LAB_DIR ?? `${process.env.HOME}/.claudish-corpus/analysis/2026-09-01-model-compare`);
const OUT = process.argv[2] ?? `${DIR}/cl2en-local-report.json`;
const modelId = process.env.GEMINI_MODEL_ID ?? "gemini-2.5-flash";
const location = process.env.GEMINI_LOCATION ?? "us-central1";

async function main() {
  const inputs = JSON.parse(
    readFileSync(process.env.CL2EN_INPUTS ?? `${DIR}/cl2en-inputs.json`, "utf8"),
  ) as Array<{ id: string; text: string }>;
  // CL2EN_SYSTEM_FILE swaps only the base prompt; the few-shot block and the canary are composed exactly
  // as buildSystem does, so an ablation differs from the deployed prompt in the base text alone.
  // CL2EN_SYSTEM_FULL=1: the file IS the whole system block (only the canary line is appended).
  const system = process.env.CL2EN_SYSTEM_FILE
    ? process.env.CL2EN_SYSTEM_FULL === "1"
      ? `${readFileSync(process.env.CL2EN_SYSTEM_FILE, "utf8").trim()}${buildSystem("cl2en").slice(buildSystem("cl2en").indexOf("\n\nInternal marker"))}`
      : `${readFileSync(process.env.CL2EN_SYSTEM_FILE, "utf8").trim()}${buildSystem("cl2en").slice(buildSystem("cl2en").indexOf("\n\nExamples:\n"))}`
    : buildSystem("cl2en");
  const rows: Array<Record<string, unknown>> = [];
  const transcript: Array<{ id: string; attempt: number; temperature: number; turns: Array<{ role: string; text: string }>; output: string }> = [];
  console.log(`model=${modelId} location=${location} eps=${process.env.LOOP_EPS ?? 'default'} extraAttempts=${process.env.LOOP_EXTRA ?? '0'}`);
  console.log(
    "id                 served p  attempts trajectory        revised  ms     usage(in/out/cached)",
  );
  for (const { id, text } of inputs) {
    const t0 = Date.now();
    const result = await runCl2enLoop(
      text,
      system,
      {
        nowMs: () => Date.now(),
        stream: (turns, attempt, temperature) => {
          const upstream = streamGemini(
            {
              projectId: "iampatterson",
              location,
              modelId,
              maxOutputTokens: 2048,
              thinkingBudget: 0,
              temperature,
            },
            system,
            turns,
            new AbortController().signal,
          );
          if (!process.env.CL2EN_TRANSCRIPT) return upstream;
          // CL2EN_TRANSCRIPT=<file>: record every turn the model sees and everything it says, per attempt.
          return (async function* () {
            let out = "";
            for await (const ev of upstream) {
              if (ev.kind === "text") out += ev.text;
              yield ev;
            }
            transcript.push({ id, attempt, temperature, turns: turns.map((t) => ({ role: t.role, text: t.text })), output: out });
          })();
        },
      },
      { token: () => undefined, revise: () => undefined },
      { ...loopBudgetFor(text.length), ...(process.env.LOOP_EPS ? { improvementEpsilon: Number(process.env.LOOP_EPS) } : {}), ...(process.env.LOOP_EXTRA ? { maxAttempts: loopBudgetFor(text.length).maxAttempts + Number(process.env.LOOP_EXTRA) } : {}), ...(process.env.LOOP_FACTS === '1' ? { factsRetry: true } : {}), ...(process.env.LOOP_RETRY_TEMP ? { retryTemperature: Number(process.env.LOOP_RETRY_TEMP) } : {}), ...(process.env.LOOP_FEEDBACK === 'symptoms' ? { feedbackStyle: 'symptoms' as const } : process.env.LOOP_FEEDBACK === 'axis' ? { feedbackStyle: 'axis' as const } : process.env.LOOP_FEEDBACK === 'contract' ? { feedbackStyle: 'contract' as const } : {}), ...(process.env.CL2EN_USER_TURN ? { userTurnPrefix: process.env.CL2EN_USER_TURN } : {}), ...(process.env.LOOP_SENTENCE_JUDGE ? { sentenceJudge: { threshold: Number(process.env.LOOP_SENTENCE_JUDGE.split(',')[0]), minChars: Number(process.env.LOOP_SENTENCE_JUDGE.split(',')[1] ?? 16) } } : {}), ...(process.env.LOOP_SENTENCE_RETRY === '1' ? { sentenceRetry: true } : {}), ...(process.env.LOOP_PARALLEL ? { parallelRetries: Number(process.env.LOOP_PARALLEL) } : {}), ...(process.env.LOOP_PARAGRAPHS === '1' ? { paragraphParallel: true } : {}), ...(process.env.LOOP_STRUCT ? { structuralGate: { retryAt: Number(process.env.LOOP_STRUCT.split(',')[0]), minSentences: Number(process.env.LOOP_STRUCT.split(',')[1]) } } : {}) },
    );
    const ms = Date.now() - t0;
    if (process.env.CL2EN_TRANSCRIPT) {
      const lines: string[] = [`# cl2en loop transcript: ${id}`, ``, `model ${modelId} | judge ${process.env.LOOP_JUDGE_MODELS ?? "vendored ensemble"} | attempts ${result.attempts.length} | served attempt ${result.servedAttempt} | passed ${result.passed}`, ``, `## System block (${system.length} chars, sent with every attempt)`, ``, "```", system, "```", ``];
      for (const t of transcript.filter((x) => x.id === id)) {
        const a = result.attempts[t.attempt - 1];
        lines.push(`## Attempt ${t.attempt} (temperature ${t.temperature})`, ``);
        for (const turn of t.turns) lines.push(`### ${turn.role} turn (${turn.text.length} chars)`, ``, "```", turn.text, "```", ``);
        lines.push(`### model output (${t.output.length} chars)`, ``, "```", t.output, "```", ``);
        if (a) { const ax = judgeAxes(smoothForJudge(t.output)); // the loop judges SMOOTHED text (markers stripped, em dashes rewritten) lines.push(`### verdict: judge p ${a.p.toFixed(3)} (register ${ax.register.toFixed(2)}, shape ${ax.shape.toFixed(2)}, heuristic ${ax.heuristic.score.toFixed(2)}) | passed ${a.p < 0.5} | retry gate open ${String(a.actionable)}${t.attempt === result.servedAttempt ? " | SERVED" : ""}`, ``); }
      }
      writeFileSync(process.env.CL2EN_TRANSCRIPT.replace(/\.md$/, "") + `-${id.replace(/[^a-z0-9]+/gi, "_")}.md`, lines.join("\n"));
    }
    const served = result.attempts[result.servedAttempt - 1]?.p ?? NaN;
    const traj = result.attempts.map((a) => a.p.toFixed(3)).join(" > ");
    console.log(
      `${id.padEnd(18)} ${served.toFixed(3).padEnd(9)} ${String(result.attempts.length).padEnd(8)} ${traj.padEnd(24)} ${String(result.revised).padEnd(8)} ${String(ms).padEnd(6)} ${result.usage.inputTokens}/${result.usage.outputTokens}/${result.usage.cachedTokens}${result.refused ? " REFUSED" : ""}`,
    );
    rows.push({
      id,
      p: Number(served.toFixed(3)),
      attempts: result.attempts,
      revised: result.revised,
      passed: result.passed,
      refused: result.refused,
      ms,
      usage: result.usage,
      factsRetried: result.factsRetried,
      factsRestored: result.factsRestored,
      out: result.servedText,
    });
  }
  const pass = rows.filter((r) => r.passed).length;
  console.log(
    `pass-rate ${pass}/${rows.length}  mean served p ${(rows.reduce((n, r) => n + (r.p as number), 0) / rows.length).toFixed(3)}`,
  );
  writeFileSync(
    OUT,
    JSON.stringify({ modelId, location, cl2en: rows }, null, 1),
  );
}
void main().catch((e) => {
  console.error(e instanceof Error ? `${e.constructor.name}: ${e.message}` : e);
  process.exit(1);
});
