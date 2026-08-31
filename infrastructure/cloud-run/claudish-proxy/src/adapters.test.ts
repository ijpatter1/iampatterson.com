/**
 * claudish-proxy — adapter tests (feat/claudish, proxy T11).
 * Parameter shaping + event translation only; no SDK network surface.
 */
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
    const system = params.system as unknown as Array<Record<string, unknown>>;
    expect(system).toHaveLength(1);
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(String(system[0].text)).toContain(CANARY_TOKEN);
    expect(params.messages).toEqual([{ role: 'user', content: 'translate me' }]);
  });

  it('embeds few-shots only in the en2cl system block', () => {
    const en2cl = String(
      (buildMessageParams('en2cl', 'x', 'm').system as Array<{ text: string }>)[0].text
    );
    const cl2en = String(
      (buildMessageParams('cl2en', 'x', 'm').system as Array<{ text: string }>)[0].text
    );
    expect(en2cl).toContain('Examples:');
    expect(cl2en).not.toContain('Examples:');
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
  it('skips the anthropic lane without its key rather than crashing', () => {
    const config = loadConfig({ LANES: 'anthropic-api,cache-only' });
    expect(buildLanes(config, {}).map((l) => l.name)).toEqual([]);
  });

  it('builds vertex lanes with the configured model id', () => {
    const config = loadConfig({ LANES: 'vertex-global,vertex-regional' });
    const lanes = buildLanes(config, {});
    expect(lanes.map((l) => l.name)).toEqual(['vertex-global', 'vertex-regional']);
    expect(lanes[0].modelId).toBe(config.vertexModelId);
  });
});
