/**
 * claudish-proxy — quality capture runner (dev utility, not a test).
 *
 * Streams every golden case through the FIRST configured lane, applies
 * the property assertions, and writes a JSON report with outputs, token
 * usage, and cost — the instrument for prompt-iteration loops where a
 * human (or a judge panel) reads the outputs between runs. The golden
 * Jest suite stays the official pass/fail gate; this runner exists so
 * iteration doesn't require scraping test output.
 *
 * Usage:
 *   npx tsx src/quality-capture.ts --out /path/report.json
 * Env: same lane/WIF contract as golden (see run-claudish-golden.sh).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildLanes } from './adapters';
import { loadConfig } from './config';
import { assertCl2En, assertEn2Cl, assertInjectionSafe } from './assertions';
import { CANARY_TOKEN, PROMPT_VERSION } from './prompts';

import type { Direction } from './config';
import type { UpstreamEvent } from './lanes';

interface GoldenCase {
  id: string;
  input: string;
  injection?: boolean;
}

interface CaseResult {
  id: string;
  direction: Direction;
  input: string;
  output: string;
  failures: Array<{ property: string; detail: string }>;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const IN_USD_PER_TOKEN = 1.0 / 1e6;
const OUT_USD_PER_TOKEN = 5.0 / 1e6;

async function runCase(
  lane: ReturnType<typeof buildLanes>[number],
  direction: Direction,
  c: GoldenCase
): Promise<CaseResult> {
  let output = '';
  let inputTokens = 0;
  let outputTokens = 0;
  const controller = new AbortController();
  const stream: AsyncIterable<UpstreamEvent> = lane.stream(
    { direction, text: c.input },
    controller.signal
  );
  for await (const event of stream) {
    if (event.kind === 'text') output += event.text;
    if (event.kind === 'stop') {
      inputTokens = event.usage.inputTokens + event.usage.cacheWriteTokens;
      outputTokens = event.usage.outputTokens;
    }
  }
  const failures = c.injection
    ? assertInjectionSafe(output, CANARY_TOKEN)
    : direction === 'cl2en'
      ? assertCl2En(c.input, output)
      : assertEn2Cl(c.input, output);
  return {
    id: c.id,
    direction,
    input: c.input,
    output,
    failures,
    inputTokens,
    outputTokens,
    costUsd: inputTokens * IN_USD_PER_TOKEN + outputTokens * OUT_USD_PER_TOKEN,
  };
}

async function main(): Promise<void> {
  const outFlag = process.argv.indexOf('--out');
  const outPath = outFlag >= 0 ? process.argv[outFlag + 1] : 'quality-report.json';
  const config = loadConfig(process.env);
  const lanes = buildLanes(config, process.env);
  if (lanes.length === 0) throw new Error('no client lanes available — check WIF env');
  const lane = lanes[0];

  const results: CaseResult[] = [];
  for (const direction of ['cl2en', 'en2cl'] as Direction[]) {
    const fixtures = JSON.parse(
      readFileSync(path.join(__dirname, '..', 'golden', `${direction}.json`), 'utf8')
    ) as { cases: GoldenCase[] };
    for (const c of fixtures.cases) {
      const r = await runCase(lane, direction, c);
      results.push(r);
      const mark = r.failures.length === 0 ? 'ok  ' : 'FAIL';
      console.log(
        `${mark} ${r.id} $${r.costUsd.toFixed(5)} ${r.failures.map((f) => f.property).join(',')}`
      );
    }
  }
  const totalCost = results.reduce((a, r) => a + r.costUsd, 0);
  const report = {
    promptVersion: PROMPT_VERSION,
    lane: lane.name,
    modelId: lane.modelId,
    totalCostUsd: totalCost,
    failing: results.filter((r) => r.failures.length > 0).length,
    results,
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\ntotal $${totalCost.toFixed(4)} · ${report.failing} failing · → ${outPath}`);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
