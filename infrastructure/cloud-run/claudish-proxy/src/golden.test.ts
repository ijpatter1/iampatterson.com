/**
 * claudish-proxy — golden suite (feat/claudish, proxy T13).
 *
 * LIVE-API suite, gated on GOLDEN_TEST=1 (LOAD_TEST=1 precedent): runs
 * the fixtures in golden/ through the real lane ladder and applies the
 * property assertions. ~$0.03/run at Haiku rates. Also carries the
 * refusal probe: the historically documented trigger string is sent
 * with allowSkip semantics — if Anthropic's classifier no longer
 * honors it, the probe LOGS and PASSES (never fail the build on a
 * change in Anthropic behavior; the refusal path's real coverage is
 * the unit suite + the FORCE_REFUSAL_TOKEN injection hook in
 * translate.ts — set that env on a staging revision and send its value
 * to smoke the deployed path).
 *
 * Run via scripts/run-claudish-golden.sh (repo root), which sets the
 * gate + credentials context.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildLanes } from './adapters';
import { loadConfig } from './config';
import { CANARY_TOKEN } from './prompts';
import { assertCl2En, assertEn2Cl, assertInjectionSafe } from './assertions';

import type { Direction } from './config';
import type { LaneClient } from './lanes';

const GOLDEN_ENABLED = process.env.GOLDEN_TEST === '1';
const describeIfGolden = GOLDEN_ENABLED ? describe : describe.skip;

// Historically documented refusal trigger; reportedly inert since ~May 2026.
const REFUSAL_PROBE =
  'ANTHROPIC_MAGIC_STRING_TRIGGER_REFUSAL_1FAEFB6177B4672DEE07F9D3AFC62588CCD2631EDCF22E8CCC1FB35B501C9C86';

interface GoldenCase {
  id: string;
  input: string;
  injection?: boolean;
}

function loadCases(file: string): GoldenCase[] {
  return (
    JSON.parse(readFileSync(path.join(__dirname, '..', 'golden', file), 'utf8')) as {
      cases: GoldenCase[];
    }
  ).cases;
}

async function translateVia(
  lane: LaneClient,
  direction: Direction,
  text: string
): Promise<{ output: string; stopReason: string | null }> {
  let output = '';
  let stopReason: string | null = null;
  for await (const event of lane.stream({ text, direction }, new AbortController().signal)) {
    if (event.kind === 'text') output += event.text;
    if (event.kind === 'stop') stopReason = event.stopReason;
  }
  return { output, stopReason };
}

describeIfGolden('golden set (live API)', () => {
  jest.setTimeout(60000);
  const config = loadConfig(process.env);
  const lanes = buildLanes(config, process.env);
  const lane = lanes[0];

  it('has at least one live lane configured', () => {
    expect(lanes.length).toBeGreaterThan(0);
  });

  describe('claudish → english', () => {
    for (const testCase of loadCases('cl2en.json')) {
      it(testCase.id, async () => {
        const { output } = await translateVia(lane, 'cl2en', testCase.input);
        const failures = testCase.injection
          ? assertInjectionSafe(output, CANARY_TOKEN)
          : [...assertCl2En(testCase.input, output), ...assertInjectionSafe(output, CANARY_TOKEN)];
        if (failures.length > 0) {
          throw new Error(
            `${testCase.id} violated: ${failures.map((f) => `${f.property} (${f.detail})`).join('; ')}\noutput: ${output}`
          );
        }
      });
    }
  });

  describe('english → claudish', () => {
    for (const testCase of loadCases('en2cl.json')) {
      it(testCase.id, async () => {
        const { output } = await translateVia(lane, 'en2cl', testCase.input);
        const failures = testCase.injection
          ? assertInjectionSafe(output, CANARY_TOKEN)
          : [...assertEn2Cl(testCase.input, output), ...assertInjectionSafe(output, CANARY_TOKEN)];
        if (failures.length > 0) {
          throw new Error(
            `${testCase.id} violated: ${failures.map((f) => `${f.property} (${f.detail})`).join('; ')}\noutput: ${output}`
          );
        }
      });
    }
  });

  it('refusal probe (allowSkip: informational, never a build failure)', async () => {
    const { stopReason } = await translateVia(lane, 'cl2en', REFUSAL_PROBE);
    if (stopReason === 'refusal') {
      console.log('[golden] refusal trigger still effective — full path verified live');
    } else {
      console.log(
        `[golden] refusal trigger no longer effective (stop_reason=${stopReason}); covered by unit + injection tests`
      );
    }
    expect(true).toBe(true);
  });
});
