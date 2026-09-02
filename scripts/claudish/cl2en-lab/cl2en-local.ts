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

const DIR = (process.env.CL2EN_LAB_DIR ?? `${process.env.HOME}/.claudish-corpus/analysis/2026-09-01-model-compare`);
const OUT = process.argv[2] ?? `${DIR}/cl2en-local-report.json`;
const modelId = process.env.GEMINI_MODEL_ID ?? "gemini-2.5-flash";
const location = process.env.GEMINI_LOCATION ?? "us-central1";

async function main() {
  const inputs = JSON.parse(
    readFileSync(process.env.CL2EN_INPUTS ?? `${DIR}/cl2en-inputs.json`, "utf8"),
  ) as Array<{ id: string; text: string }>;
  const system = buildSystem("cl2en");
  const rows: Array<Record<string, unknown>> = [];
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
        stream: (turns, _attempt, temperature) =>
          streamGemini(
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
          ),
      },
      { token: () => undefined, revise: () => undefined },
      { ...loopBudgetFor(text.length), ...(process.env.LOOP_EPS ? { improvementEpsilon: Number(process.env.LOOP_EPS) } : {}), ...(process.env.LOOP_EXTRA ? { maxAttempts: loopBudgetFor(text.length).maxAttempts + Number(process.env.LOOP_EXTRA) } : {}), ...(process.env.LOOP_FACTS === '1' ? { factsRetry: true } : {}), ...(process.env.LOOP_RETRY_TEMP ? { retryTemperature: Number(process.env.LOOP_RETRY_TEMP) } : {}), ...(process.env.LOOP_FEEDBACK === 'symptoms' ? { feedbackStyle: 'symptoms' as const } : {}), ...(process.env.LOOP_STRUCT ? { structuralGate: { retryAt: Number(process.env.LOOP_STRUCT.split(',')[0]), minSentences: Number(process.env.LOOP_STRUCT.split(',')[1]) } } : {}) },
    );
    const ms = Date.now() - t0;
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
