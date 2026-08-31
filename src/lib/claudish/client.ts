/**
 * Claudish translator — fetch-streaming shell.
 *
 * The only module that touches bytes: POST the translate request, read
 * the response body reader, decode UTF-8 across chunk boundaries, and
 * hand complete frames to the caller via the pure parser in sse.ts.
 * Everything above this (the hook's state machine) and below it (frame
 * parsing) is pure and jsdom-testable; this shell needs only an object
 * with body.getReader() in tests.
 *
 * Abort discipline: the caller owns the AbortController. When it fires,
 * fetch/read reject with AbortError — reported as { kind: 'aborted' } so
 * the hook can swallow it silently (an abort is a keystroke, not an
 * error). The reader is always cancelled on the way out so the browser
 * closes the connection and the proxy sees req 'close' and stops paying
 * for tokens.
 */
import { parseSseBuffer } from './sse';
import type { ClaudishFrame } from './sse';

export interface TranslateRequest {
  text: string;
  direction: 'en2cl' | 'cl2en';
}

export type StreamResult =
  | { kind: 'ended' }
  | { kind: 'http'; status: number }
  | { kind: 'aborted' }
  | { kind: 'network' };

interface MinimalReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(): Promise<unknown>;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

export async function streamTranslation(
  url: string,
  request: TranslateRequest,
  signal: AbortSignal,
  onFrame: (frame: ClaudishFrame) => void,
  fetchImpl: typeof fetch = fetch
): Promise<StreamResult> {
  let response: { ok: boolean; status: number; body: { getReader(): unknown } | null };
  try {
    response = (await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })) as typeof response;
  } catch (err) {
    return isAbortError(err) ? { kind: 'aborted' } : { kind: 'network' };
  }

  if (!response.ok) {
    return { kind: 'http', status: response.status };
  }
  if (!response.body) {
    return { kind: 'network' };
  }

  const reader = response.body.getReader() as MinimalReader;
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) return { kind: 'aborted' };
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = parseSseBuffer(buffer);
      buffer = rest;
      for (const frame of frames) onFrame(frame);
    }
    return { kind: 'ended' };
  } catch (err) {
    return isAbortError(err) || signal.aborted ? { kind: 'aborted' } : { kind: 'network' };
  } finally {
    // Always release the connection so the proxy sees the close and
    // aborts its upstream call — an abandoned stream is pure token burn.
    reader.cancel().catch(() => undefined);
  }
}
