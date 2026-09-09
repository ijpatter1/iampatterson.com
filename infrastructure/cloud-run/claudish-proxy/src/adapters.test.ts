/**
 * claudish-proxy — adapter tests (feat/claudish, proxy T11).
 * Parameter shaping + event translation only; no SDK network surface.
 */
const mockVertex = { constructions: 0 };
jest.mock('@anthropic-ai/vertex-sdk', () => ({
  AnthropicVertex: class {
    messages = {
      create: () => Promise.reject(new Error('stream not exercised by this suite')),
    };
    constructor() {
      mockVertex.constructions += 1;
    }
  },
}));

import { adaptAnthropicStream, buildMessageParams, buildLanes } from './adapters';
import { loadConfig, MAX_TOKENS } from './config';
import { CANARY_TOKEN } from './prompts';

import type { UpstreamEvent } from './lanes';

const SECRET_EXPLANATION = 'explanation quoting the user input verbatim';

async function collect(events: AsyncIterable<UpstreamEvent>): Promise<UpstreamEvent[]> {
  const out: UpstreamEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

async function* streamOf(events: unknown[]): AsyncIterable<unknown> {
  for (const e of events) yield e;
}

describe('buildMessageParams', () => {
  it('shapes the latency-critical request: capped tokens, stream, one cached system block', () => {
    const params = buildMessageParams('en2cl', 'translate me', 'model-x');
    expect(params.model).toBe('model-x');
    expect(params.max_tokens).toBe(MAX_TOKENS.en2cl);
    expect(params.stream).toBe(true);
    // Deterministic translator: temp 0 both directions (nonzero temps
    // resample failure tails instead of fixing them — overnight loop).
    expect(params.temperature).toBe(0);
    expect(buildMessageParams('cl2en', 'x', 'm').temperature).toBe(0);
    const system = params.system as unknown as Array<Record<string, unknown>>;
    expect(system).toHaveLength(1);
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(String(system[0].text)).toContain(CANARY_TOKEN);
    // v2: the user turn is delimiter-wrapped so question-shaped input
    // reads as data, not as a message addressed to the model.
    expect(params.messages).toHaveLength(1);
    const content = String(params.messages[0].content);
    expect(content).toContain('<text>\ntranslate me\n</text>');
    expect(content).toContain('not a message to you');
  });

  it('embeds direction-matched few-shots in each system block', () => {
    const en2cl = String(
      (buildMessageParams('en2cl', 'x', 'm').system as Array<{ text: string }>)[0].text
    );
    const cl2en = String(
      (buildMessageParams('cl2en', 'x', 'm').system as Array<{ text: string }>)[0].text
    );
    expect(en2cl).toContain('Examples:');
    expect(cl2en).toContain('Examples:');
    // Each direction carries its own set, not the other's.
    expect(en2cl).toContain('The login bug is fixed');
    expect(cl2en).toContain('Users want dark mode, and adding it would help engagement.');
    expect(cl2en).not.toContain('The login bug is fixed');
    // v11 example 7 rides in cl2en: acronyms, the decimal and the
    // identifier survive the register verbatim.
    expect(cl2en).toContain('The SE on the treated arm is wider because of the 0.85 treated share');
    expect(cl2en).toContain('em dashes');
  });

  it('caps cl2en tighter than en2cl (English compresses)', () => {
    expect(MAX_TOKENS.cl2en).toBeLessThan(MAX_TOKENS.en2cl);
  });
});

describe('adaptAnthropicStream', () => {
  it('translates the happy streaming vocabulary', async () => {
    const events = await collect(
      adaptAnthropicStream(
        streamOf([
          { type: 'message_start', message: { usage: { input_tokens: 900, cache_read_input_tokens: 800 } } },
          { type: 'content_block_start' },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } },
          { type: 'ping' },
          { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 42 } },
          { type: 'message_stop' },
        ])
      )
    );
    expect(events[0]).toEqual({ kind: 'start' });
    expect(events[1]).toEqual({ kind: 'text', text: 'Hel' });
    expect(events[2]).toEqual({ kind: 'text', text: 'lo' });
    const stop = events[3] as Extract<UpstreamEvent, { kind: 'stop' }>;
    expect(stop.stopReason).toBe('end_turn');
    expect(stop.usage.outputTokens).toBe(42);
    expect(stop.usage.inputTokens).toBe(900);
    expect(stop.usage.cacheReadTokens).toBe(800);
  });

  it('surfaces refusal category but NEVER the explanation', async () => {
    const events = await collect(
      adaptAnthropicStream(
        streamOf([
          { type: 'message_start', message: { usage: {} } },
          {
            type: 'message_delta',
            delta: {
              stop_reason: 'refusal',
              stop_details: { category: 'general_harms', explanation: SECRET_EXPLANATION },
            },
            usage: { output_tokens: 3 },
          },
        ])
      )
    );
    const stop = events[events.length - 1] as Extract<UpstreamEvent, { kind: 'stop' }>;
    expect(stop.stopReason).toBe('refusal');
    expect(stop.refusalCategory).toBe('general_harms');
    expect(JSON.stringify(events)).not.toContain(SECRET_EXPLANATION);
  });

  it('tolerates unknown event types (SDK drift)', async () => {
    const events = await collect(
      adaptAnthropicStream(streamOf([{ type: 'brand_new_event' }, { type: 'message_stop' }]))
    );
    expect(events).toEqual([
      {
        kind: 'stop',
        stopReason: null,
        refusalCategory: undefined,
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      },
    ]);
  });
});

describe('buildLanes', () => {
  const WIF_ENV = {
    ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test123',
    ANTHROPIC_ORGANIZATION_ID: '00000000-0000-0000-0000-000000000000',
    ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test123',
    ANTHROPIC_WORKSPACE_ID: 'wrkspc_test123',
  };

  it('skips the anthropic lane without its federation ids rather than crashing', () => {
    const config = loadConfig({ LANES: 'anthropic-api,cache-only' });
    expect(buildLanes(config, {}).map((l) => l.name)).toEqual([]);
  });

  it('does not resurrect the lane from a leftover ANTHROPIC_API_KEY', () => {
    // The lane authenticates via WIF only. A stray key must not silently
    // re-enable key auth (SDK env precedence would shadow federation).
    const config = loadConfig({ LANES: 'anthropic-api,cache-only' });
    expect(buildLanes(config, { ANTHROPIC_API_KEY: 'sk-ant-stray' }).map((l) => l.name)).toEqual(
      []
    );
  });

  it('builds the anthropic lane from WIF federation ids', () => {
    const config = loadConfig({ LANES: 'anthropic-api,cache-only' });
    const lanes = buildLanes(config, WIF_ENV);
    expect(lanes.map((l) => l.name)).toEqual(['anthropic-api']);
    expect(lanes[0].modelId).toBe(config.anthropicModelId);
  });

  it('builds vertex lanes with the configured model id', () => {
    const config = loadConfig({ LANES: 'vertex-global,vertex-regional' });
    const lanes = buildLanes(config, {});
    expect(lanes.map((l) => l.name)).toEqual(['vertex-global', 'vertex-regional']);
    expect(lanes[0].modelId).toBe(config.vertexModelId);
  });

  // `new AnthropicVertex()` starts GoogleAuth.getClient() in its constructor and
  // holds that promise unhandled until a request awaits it. Building a lane and
  // never streaming from it therefore left a floating rejection that killed the
  // process wherever no ADC exists. `server.ts` builds lanes before it listens,
  // so that was a boot crash rather than a lane falling through to the next one.
  //
  // It surfaced only in CI because a local `gcloud auth` supplies ADC and the
  // runner has none — and because `describe.skip` still runs its body, the
  // GOLDEN_TEST gate did not spare the golden suite either. Counting
  // constructions keeps this deterministic: no credentials, no crash, a number.
  it('constructs no SDK client while merely building lanes', () => {
    const config = loadConfig({ LANES: 'vertex-global,vertex-regional' });
    mockVertex.constructions = 0;

    const lanes = buildLanes(config, {});

    expect(lanes.map((l) => l.name)).toEqual(['vertex-global', 'vertex-regional']);
    expect(mockVertex.constructions).toBe(0);
  });

  it('constructs the client on first stream, and reuses it after', async () => {
    // The mirror: deferring construction must not mean never constructing it.
    // The mock rejects in create(), so pulling the iterator is how we observe
    // that the factory ran at all — and that it ran exactly once across two.
    const config = loadConfig({ LANES: 'vertex-global,vertex-regional' });
    const lane = buildLanes(config, {})[0];
    mockVertex.constructions = 0;

    for (let i = 0; i < 2; i += 1) {
      await expect(
        lane
          .stream({ text: 'hi', direction: 'en2cl' }, new AbortController().signal)
          [Symbol.asyncIterator]()
          .next()
      ).rejects.toThrow('stream not exercised by this suite');
    }

    expect(mockVertex.constructions).toBe(1);
  });
});
