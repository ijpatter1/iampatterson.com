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
 *
 * cl2en cases run through the SERVED engine when CL2EN_ENGINE=gemini-loop
 * (the runner's default): the judge-driven Gemini loop composed as
 * translate.ts composes it. Until 2026-09-03 this file sent them through
 * lanes[0] (the Claude ladder, one pass, no loop) whatever the engine, so
 * the gate never exercised the path that serves traffic; 951846a wired
 * the runner's env without this file reading it. With LANES-only engines
 * the Claude path still applies.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildLanes } from './adapters';
import { loopBudgetFor, runCl2enLoop } from './cl2en-loop';
import { loadConfig } from './config';
import { streamGemini } from './gemini';
import { CANARY_TOKEN, buildSystem } from './prompts';
import { assertCl2En, assertEn2Cl, assertInjectionSafe } from './assertions';
import { EmDashSmoother } from './smooth';

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
  /** Cap-length case: must finish with end_turn, never a max_tokens cut. */
  long?: boolean;
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
  // Mirror production composition: cl2en output is served through the
  // EmDashSmoother (translate.ts), so the contract is asserted on what
  // a user actually receives, not the raw model text.
  const smoother = direction === 'cl2en' ? new EmDashSmoother() : null;
  for await (const event of lane.stream({ text, direction }, new AbortController().signal)) {
    if (event.kind === 'text') output += smoother ? smoother.feed(event.text) : event.text;
    if (event.kind === 'stop') output += smoother ? smoother.flush() : '';
    if (event.kind === 'stop') stopReason = event.stopReason;
  }
  return { output, stopReason };
}

/** The served cl2en path: the Gemini loop, composed as translate.ts composes it. */
async function translateCl2EnServed(
  config: ReturnType<typeof loadConfig>,
  text: string
): Promise<{ output: string; stopReason: string | null }> {
  const system = buildSystem('cl2en');
  const controller = new AbortController();
  let streamedChars = 0;
  const result = await runCl2enLoop(
    text,
    system,
    {
      nowMs: () => Date.now(),
      stream: (turns, _attempt, temperature) =>
        streamGemini(
          {
            projectId: config.projectId,
            location: config.geminiLocation,
            modelId: config.geminiModelId,
            maxOutputTokens: 2048,
            thinkingBudget: 0,
            temperature,
          },
          system,
          turns,
          controller.signal
        ),
    },
    {
      token: (t) => {
        streamedChars += t.length;
      },
      revise: () => undefined,
    },
    loopBudgetFor(text.length)
  ).catch((err: unknown) => {
    // Production's rule (translate.ts): a failure before any token falls
    // through to the Claude ladder; a failure after the first token is a
    // terminal upstream_error. Mirror both so the gate never re-serves a
    // mid-stream failure, an auth error or a config error as a pass.
    if (streamedChars === 0) throw new PreTokenFailure(err);
    throw err;
  });
  if (!result.refused && result.servedText.length === 0) {
    throw new Error('loop served an empty result (production answers with an error frame)');
  }
  const smoother = new EmDashSmoother();
  const output = smoother.feed(result.servedText) + smoother.flush();
  return { output, stopReason: result.refused ? 'refusal' : 'end_turn' };
}

class PreTokenFailure extends Error {
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'PreTokenFailure';
  }
}

/** Fall-throughs across the suite: a gate where every case fell through never exercised the served engine. */
const fallThroughs: string[] = [];

/**
 * Production's composition, including the fall-through: when the loop fails
 * before any token (a stalled or refused upstream, the 3 s first-token
 * deadline), translate.ts hands the request to the Claude ladder. The gate
 * mirrors that so a slow Gemini start reads as production would serve it,
 * not as a harness error (Phase 12, 2026-09-04).
 */
async function translateCl2EnAsServed(
  config: ReturnType<typeof loadConfig>,
  lane: LaneClient,
  text: string
): Promise<{ output: string; stopReason: string | null }> {
  try {
    return await translateCl2EnServed(config, text);
  } catch (err) {
    if (!(err instanceof PreTokenFailure)) throw err;
    const cause = err.cause instanceof Error ? err.cause.name : 'Unknown';
    // Only upstream failures fall through in production (a stall, a 4xx/5xx
    // from Vertex); a missing credential or a bad model id would too, so
    // name the cause and count it: the suite fails if every case fell through.
    fallThroughs.push(`${text.slice(0, 24)}… (${cause})`);
    console.log(`[golden] loop fell through pre-token (${cause}); Claude ladder served`);
    return translateVia(lane, 'cl2en', text);
  }
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
    const served = config.cl2enEngine === 'gemini-loop';
    it(`runs the ${served ? 'served gemini-loop' : 'Claude-lane'} engine`, () => {
      console.log(`[golden] cl2en engine: ${served ? 'gemini-loop (served path)' : 'lanes (Claude ladder)'}`);
    });
    afterAll(() => {
      const total = loadCases('cl2en.json').length;
      if (served && fallThroughs.length > 0) console.log(`[golden] ${fallThroughs.length}/${total} cl2en cases fell through: ${fallThroughs.join('; ')}`);
      // More than half falling through means the served engine is not what
      // the gate measured: fail, whatever the Claude lane produced.
      if (served && fallThroughs.length * 2 > total) {
        throw new Error(`${fallThroughs.length}/${total} cl2en cases fell through to the Claude ladder; the served engine was not exercised enough to pass (${fallThroughs[0]})`);
      }
    });
    for (const testCase of loadCases('cl2en.json')) {
      it(testCase.id, async () => {
        const { output, stopReason } = served
          ? await translateCl2EnAsServed(config, lane, testCase.input)
          : await translateVia(lane, 'cl2en', testCase.input);
        if (testCase.long && stopReason !== 'end_turn') {
          throw new Error(`${testCase.id} truncated: stop_reason=${stopReason}`);
        }
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
        const { output, stopReason } = await translateVia(lane, 'en2cl', testCase.input);
        if (testCase.long && stopReason !== 'end_turn') {
          throw new Error(`${testCase.id} truncated: stop_reason=${stopReason}`);
        }
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
