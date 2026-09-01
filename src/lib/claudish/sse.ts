/**
 * Claudish translator — SSE frame parser (client half of the wire contract).
 *
 * claudish-proxy emits `data: {"type": ...}\n\n` frames — the JSON escape
 * is what lets translation text carry newlines without breaking SSE
 * framing. This module is a pure string function: bytes-to-text decoding
 * lives in client.ts, so everything here unit-tests in jsdom with no
 * TextDecoder or ReadableStream.
 *
 * Frame vocabulary (unknown types are ignored for forward compatibility):
 *   meta     — first frame: lane, cached, direction, promptVersion
 *   token    — one text delta: { t }
 *   done     — terminal success: counts + timings
 *   refusal  — terminal: model refused; client discards partials
 *   capacity — terminal: ladder exhausted / kill switch; verbatim line
 *   error    — terminal: generic failure (shown as the capacity line)
 */

export type ClaudishFrame =
  | {
      type: 'meta';
      lane?: string;
      cached?: boolean;
      direction?: string;
      promptVersion?: string;
    }
  | { type: 'token'; t: string }
  | { type: 'done'; chars?: number; ttftMs?: number; totalMs?: number; cached?: boolean }
  | { type: 'refusal' }
  | { type: 'capacity' }
  | { type: 'revise' }
  | { type: 'error'; code?: string };

const FRAME_TYPES = new Set(['meta', 'token', 'done', 'refusal', 'capacity', 'error', 'revise']);

function parseBlock(block: string): ClaudishFrame | null {
  // Per the SSE spec, a block may hold multiple `data:` lines (joined with
  // newlines) and comment lines starting with ':'.
  const dataLines: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith(':')) continue; // comment / keepalive
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(dataLines.join('\n'));
  } catch {
    return null; // malformed frame: skip, never throw
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as { type?: unknown; t?: unknown };
  if (typeof candidate.type !== 'string' || !FRAME_TYPES.has(candidate.type)) {
    return null;
  }
  if (candidate.type === 'token' && typeof candidate.t !== 'string') {
    return null;
  }
  return parsed as ClaudishFrame;
}

/**
 * Parse as many complete frames as the buffer holds; return the unfinished
 * tail as `rest` for the caller to prepend to the next chunk.
 */
export function parseSseBuffer(buffer: string): {
  frames: ClaudishFrame[];
  rest: string;
} {
  const frames: ClaudishFrame[] = [];
  // Frames end at a blank line: \n\n, or \r\n\r\n from CRLF writers.
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    const frame = parseBlock(block);
    if (frame) frames.push(frame);
  }
  return { frames, rest };
}
