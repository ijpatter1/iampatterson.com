/**
 * @jest-environment jsdom
 *
 * Claudish translator — translation state machine (feat/claudish M2, phase C).
 *
 * The hook that makes the ride feel like Google Translate: ~600ms
 * debounce, abort-on-edit with stale output dimmed until the first new
 * token, refusal discards partial AND stale, capacity/error render the
 * verbatim boundary line, client LRU short-circuits repeats, and a
 * missing proxy URL degrades to capacity — the page never shows a broken
 * state. Aborts never fire analytics.
 */
import { act, renderHook } from '@testing-library/react';

jest.mock('@/lib/claudish/client', () => ({
  streamTranslation: jest.fn(),
}));
jest.mock('@/lib/events/track', () => ({
  trackClaudishTranslate: jest.fn(),
}));

import { streamTranslation } from '@/lib/claudish/client';
import { trackClaudishTranslate } from '@/lib/events/track';
import { useClaudishTranslation } from '@/hooks/useClaudishTranslation';
import type { ClaudishFrame } from '@/lib/claudish/sse';

const mockStream = streamTranslation as jest.Mock;
const mockTrack = trackClaudishTranslate as jest.Mock;

interface FakeStream {
  url: string;
  req: { text: string; direction: string };
  signal: AbortSignal;
  onFrame: (f: ClaudishFrame) => void;
  resolve: (r: unknown) => void;
}

let streams: FakeStream[];

beforeEach(() => {
  jest.useFakeTimers();
  streams = [];
  mockStream.mockReset();
  mockTrack.mockReset();
  mockStream.mockImplementation(
    (url: string, req: FakeStream['req'], signal: AbortSignal, onFrame: FakeStream['onFrame']) =>
      new Promise((resolve) => {
        const stream: FakeStream = { url, req, signal, onFrame, resolve };
        signal.addEventListener('abort', () => resolve({ kind: 'aborted' }));
        streams.push(stream);
      })
  );
});

afterEach(() => {
  jest.useRealTimers();
});

const PROXY = 'https://proxy.example/translate';

function renderTranslation(initial: { input: string; direction?: 'en2cl' | 'cl2en' }) {
  return renderHook(
    ({ input, direction }: { input: string; direction: 'en2cl' | 'cl2en' }) =>
      useClaudishTranslation({ input, direction, proxyUrl: PROXY }),
    { initialProps: { input: initial.input, direction: initial.direction ?? 'en2cl' } }
  );
}

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const frame = async (f: ClaudishFrame) => {
  await act(async () => {
    streams[streams.length - 1].onFrame(f);
  });
};
const endStream = async (result: unknown = { kind: 'ended' }) => {
  await act(async () => {
    streams[streams.length - 1].resolve(result);
  });
};

describe('debounce', () => {
  it('fires exactly one request after the 600ms pause, not before', async () => {
    const { result, rerender } = renderTranslation({ input: 'Hello world, this is a test.' });
    expect(result.current.status).toBe('debouncing');
    await advance(599);
    expect(mockStream).not.toHaveBeenCalled();
    await advance(1);
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('streaming');

    // Rapid typing: each keystroke resets the timer; only one more call.
    rerender({ input: 'Hello world, this is a te', direction: 'en2cl' });
    await advance(300);
    rerender({ input: 'Hello world, this is a test again', direction: 'en2cl' });
    await advance(599);
    expect(mockStream).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(mockStream).toHaveBeenCalledTimes(2);
  });

  it('stays idle on empty and whitespace-only input', async () => {
    const { result } = renderTranslation({ input: '   \n ' });
    expect(result.current.status).toBe('idle');
    await advance(1000);
    expect(mockStream).not.toHaveBeenCalled();
  });
});

describe('streaming', () => {
  it('accumulates tokens, records ttft on the first, and clears stale then', async () => {
    const { result, rerender } = renderTranslation({ input: 'First input to translate.' });
    await advance(600);
    await frame({ type: 'meta', lane: 'vertex-global', cached: false });
    await frame({ type: 'token', t: 'Bonjour' });
    expect(result.current.hasFirstToken).toBe(true);
    expect(result.current.ttftMs).not.toBeNull();
    await frame({ type: 'token', t: ' le monde' });
    expect(result.current.text).toBe('Bonjour le monde');
    await frame({ type: 'done', chars: 16 });
    await endStream();
    expect(result.current.status).toBe('done');

    // A new input demotes the finished text to dimmed stale output.
    rerender({ input: 'Second, different input.', direction: 'en2cl' });
    expect(result.current.status).toBe('debouncing');
    expect(result.current.staleText).toBe('Bonjour le monde');
    await advance(600);
    expect(result.current.staleText).toBe('Bonjour le monde');
    await frame({ type: 'token', t: 'Deuxième' });
    expect(result.current.staleText).toBe(''); // first new token clears it
    expect(result.current.text).toBe('Deuxième');
  });

  it('fires claudish_translate with outcome complete exactly once per completion', async () => {
    renderTranslation({ input: 'Complete this translation now.' });
    await advance(600);
    await frame({ type: 'token', t: 'Done text' });
    await frame({ type: 'done' });
    await endStream();
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack.mock.calls[0][0]).toMatchObject({
      outcome: 'complete',
      direction: 'en_to_claudish',
      cache: 'miss',
    });
  });
});

describe('abort on edit', () => {
  it('aborts the in-flight request, keeps stale dimmed, and fires no event', async () => {
    const { result, rerender } = renderTranslation({ input: 'The original long input.' });
    await advance(600);
    await frame({ type: 'token', t: 'partial out' });
    const firstSignal = streams[0].signal;
    rerender({ input: 'The original long input, edited.', direction: 'en2cl' });
    await act(async () => {}); // flush the abort effect
    expect(firstSignal.aborted).toBe(true);
    expect(result.current.status).toBe('debouncing');
    expect(mockTrack).not.toHaveBeenCalled();
    // The partial output of the aborted stream stays visible as stale.
    expect(result.current.staleText).toBe('partial out');
  });
});

describe('refusal', () => {
  it('discards partial AND stale output, does not cache, fires outcome refused', async () => {
    const { result, rerender } = renderTranslation({ input: 'A fine first input.' });
    await advance(600);
    await frame({ type: 'token', t: 'previous answer' });
    await frame({ type: 'done' });
    await endStream();

    rerender({ input: 'Something that gets refused.', direction: 'en2cl' });
    await advance(600);
    await frame({ type: 'token', t: 'partial refuse' });
    await frame({ type: 'refusal' });
    await endStream();
    expect(result.current.status).toBe('refused');
    expect(result.current.text).toBe('');
    expect(result.current.staleText).toBe('');
    expect(mockTrack).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'refused', output_chars: 0 })
    );

    // Refusals are REMEMBERED (never content-cached): retyping the same
    // input replays the verdict without a request — re-sending would
    // re-refuse and burn tokens for nothing.
    rerender({ input: 'A fine first input.', direction: 'en2cl' });
    await advance(600);
    rerender({ input: 'Something that gets refused.', direction: 'en2cl' });
    await advance(600);
    const requested = mockStream.mock.calls.map((c) => c[1].text);
    expect(requested.filter((t) => t === 'Something that gets refused.')).toHaveLength(1);
  });
});

describe('capacity and errors', () => {
  it('maps the capacity frame to capacity status', async () => {
    const { result } = renderTranslation({ input: 'Push this through the ladder.' });
    await advance(600);
    await frame({ type: 'capacity' });
    await endStream();
    expect(result.current.status).toBe('capacity');
    expect(mockTrack).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'capacity' })
    );
  });

  it('maps HTTP 429/503 to capacity and other failures to error', async () => {
    const { result, rerender } = renderTranslation({ input: 'Rate limited request body.' });
    await advance(600);
    await endStream({ kind: 'http', status: 429 });
    expect(result.current.status).toBe('capacity');

    rerender({ input: 'A different failing input.', direction: 'en2cl' });
    await advance(600);
    await endStream({ kind: 'network' });
    expect(result.current.status).toBe('error');
    expect(mockTrack).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'error' })
    );
  });

  it('degrades to capacity when no proxy URL is configured — never a broken state', async () => {
    const { result } = renderHook(() =>
      useClaudishTranslation({
        input: 'No proxy configured for this one.',
        direction: 'en2cl',
        proxyUrl: undefined,
      })
    );
    await advance(600);
    expect(result.current.status).toBe('capacity');
    expect(mockStream).not.toHaveBeenCalled();
  });
});

describe('client cache', () => {
  it('serves a repeated input from the client cache with no request and ttft 0', async () => {
    const { result, rerender } = renderTranslation({ input: 'Cache me if you can.' });
    await advance(600);
    await frame({ type: 'token', t: 'Cached result' });
    await frame({ type: 'done' });
    await endStream();
    expect(mockStream).toHaveBeenCalledTimes(1);

    rerender({ input: 'Now something else entirely.', direction: 'en2cl' });
    await advance(600);
    await frame({ type: 'token', t: 'Other' });
    await frame({ type: 'done' });
    await endStream();
    expect(mockStream).toHaveBeenCalledTimes(2);

    rerender({ input: 'Cache me if you can.', direction: 'en2cl' });
    await advance(600);
    expect(mockStream).toHaveBeenCalledTimes(2); // no third request
    expect(result.current.status).toBe('done');
    expect(result.current.text).toBe('Cached result');
    expect(result.current.cache).toBe('client');
    expect(result.current.ttftMs).toBe(0);
    expect(mockTrack).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: 'complete', cache: 'client', ttft_ms: 0 })
    );
  });

  it('marks server-cache hits from the meta frame', async () => {
    const { result } = renderTranslation({ input: 'Popular input everyone tries.' });
    await advance(600);
    await frame({ type: 'meta', cached: true });
    await frame({ type: 'token', t: 'Served hot' });
    await frame({ type: 'done', cached: true });
    await endStream();
    expect(result.current.cache).toBe('server');
    expect(mockTrack).toHaveBeenLastCalledWith(
      expect.objectContaining({ cache: 'server' })
    );
  });
});

describe('unmount', () => {
  it('aborts the in-flight stream and never updates state afterwards', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderTranslation({ input: 'Unmount mid-stream please.' });
    await advance(600);
    const signal = streams[0].signal;
    unmount();
    expect(signal.aborted).toBe(true);
    // Late frames after unmount must not warn about state updates.
    streams[0].onFrame({ type: 'token', t: 'late' });
    expect(
      errorSpy.mock.calls.filter((c) => String(c[0]).includes('unmounted'))
    ).toHaveLength(0);
    errorSpy.mockRestore();
  });
});

describe('manual translation survival (CR5)', () => {
  it('translateNow with an override survives the debounce effect and completes as manual', async () => {
    const { result, rerender } = renderTranslation({ input: 'First input to swap from.' });
    await advance(600);
    await frame({ type: 'token', t: 'output text' });
    await frame({ type: 'done' });
    await endStream();
    mockTrack.mockClear();

    // Swap: state changes + immediate manual fire in the same commit.
    await act(async () => {
      result.current.translateNow({ input: 'output text', direction: 'cl2en' });
    });
    rerender({ input: 'output text', direction: 'cl2en' });
    await act(async () => {});
    const manualStream = streams[streams.length - 1];
    expect(manualStream.req).toEqual({ text: 'output text', direction: 'cl2en' });
    // The debounce effect must NOT have aborted its own manual stream...
    expect(manualStream.signal.aborted).toBe(false);
    // ...nor armed a doomed auto re-fire.
    const callsBefore = mockStream.mock.calls.length;
    await advance(700);
    expect(mockStream.mock.calls.length).toBe(callsBefore);
    // And it completes with the manual label intact.
    await frame({ type: 'token', t: 'English.' });
    await frame({ type: 'done' });
    await endStream();
    expect(result.current.status).toBe('done');
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack.mock.calls[0][0]).toMatchObject({
      source_mode: 'manual',
      outcome: 'complete',
    });
  });

  it('retyping the identical input during streaming does not abort the stream', async () => {
    const { rerender } = renderTranslation({ input: 'Same text streaming now.' });
    await advance(600);
    await frame({ type: 'token', t: 'partial' });
    const signal = streams[0].signal;
    // A no-op re-render with identical input (e.g. parent state churn).
    rerender({ input: 'Same text streaming now.', direction: 'en2cl' });
    await act(async () => {});
    expect(signal.aborted).toBe(false);
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  it('a genuine edit mid-stream still aborts', async () => {
    const { rerender } = renderTranslation({ input: 'Original text being streamed.' });
    await advance(600);
    const signal = streams[0].signal;
    rerender({ input: 'Original text being streamed, edited.', direction: 'en2cl' });
    await act(async () => {});
    expect(signal.aborted).toBe(true);
  });
});

describe('transient failures are retryable (CR7)', () => {
  it('re-entering the same text after a network error fires a fresh request', async () => {
    const { result, rerender } = renderTranslation({ input: 'Text that will fail once.' });
    await advance(600);
    await endStream({ kind: 'network' });
    expect(result.current.status).toBe('error');
    // Edit away, then back to the identical text.
    rerender({ input: 'Different text now.', direction: 'en2cl' });
    await advance(600);
    await endStream({ kind: 'network' });
    rerender({ input: 'Text that will fail once.', direction: 'en2cl' });
    await advance(600);
    const requested = mockStream.mock.calls.map((c) => c[1].text);
    expect(requested.filter((t) => t === 'Text that will fail once.')).toHaveLength(2);
  });

  it('refusals stay sticky: the same input is not re-sent', async () => {
    const { rerender } = renderTranslation({ input: 'Input that gets refused.' });
    await advance(600);
    await frame({ type: 'refusal' });
    await endStream();
    rerender({ input: 'Other text meanwhile.', direction: 'en2cl' });
    await advance(600);
    await frame({ type: 'token', t: 'x' });
    await frame({ type: 'done' });
    await endStream();
    rerender({ input: 'Input that gets refused.', direction: 'en2cl' });
    await advance(600);
    const requested = mockStream.mock.calls.map((c) => c[1].text);
    expect(requested.filter((t) => t === 'Input that gets refused.')).toHaveLength(1);
  });
});

describe('stale-streaming recovery (round-2 re-check finding)', () => {
  it('edit away and back within the debounce re-fires instead of stranding "streaming"', async () => {
    const { result, rerender } = renderTranslation({ input: 'Original sentence to stream.' });
    await advance(600); // stream A in flight
    // Edit (aborts A), then revert to the exact original before the timer fires.
    rerender({ input: 'Original sentence to stream, edited.', direction: 'en2cl' });
    await act(async () => {});
    rerender({ input: 'Original sentence to stream.', direction: 'en2cl' });
    await advance(600);
    // A fresh stream for the original key must exist — not a stale hang.
    const requested = mockStream.mock.calls.map((c) => c[1].text);
    expect(requested.filter((t) => t === 'Original sentence to stream.')).toHaveLength(2);
    await frame({ type: 'token', t: 'Recovered.' });
    await frame({ type: 'done' });
    await endStream();
    expect(result.current.status).toBe('done');
  });

  it('a manual fire to a cached key cancels a different key’s live stream', async () => {
    const { result, rerender } = renderTranslation({ input: 'Cache this first sentence.' });
    await advance(600);
    await frame({ type: 'token', t: 'cached out' });
    await frame({ type: 'done' });
    await endStream();

    rerender({ input: 'A second sentence now streaming.', direction: 'en2cl' });
    await advance(600);
    const liveSignal = streams[streams.length - 1].signal;
    await act(async () => {
      result.current.translateNow({ input: 'Cache this first sentence.', direction: 'en2cl' });
    });
    expect(liveSignal.aborted).toBe(true); // the burn stops even on the cache-hit path
  });
});
