/**
 * Claudish corpus miner — drift-tolerant transcript record parser.
 *
 * Claude Code transcripts span CLI versions 2.1.183–2.1.252 in one
 * corpus (a single file can span versions across resumes). The contract
 * here is the spec's: tolerate unknown record types, missing fields,
 * and malformed lines — count them, never throw. The only invariant we
 * rely on (verified across the whole version range): assistant records
 * have .message.content as an ARRAY of blocks, and prose lives in
 * blocks of type 'text'.
 */

export interface ParsedAssistantText {
  kind: 'assistant-text';
  texts: string[];
  isSidechain: boolean;
}

export interface ParsedHumanTurn {
  kind: 'human-turn';
  isSidechain: boolean;
}

export interface ParsedOther {
  kind: 'other' | 'malformed';
}

export type ParsedRecord = ParsedAssistantText | ParsedHumanTurn | ParsedOther;

/** Cheap prefilter: skip ~60% of lines (and most bytes) before JSON.parse. */
export function mightBeAssistant(line: string): boolean {
  return line.includes('"assistant"');
}

/** Cheap prefilter for typed human turns: user records that are not tool results. */
export function mightBeHumanTurn(line: string): boolean {
  return line.includes('"user"') && !line.includes('tool_result');
}

function isHumanTurn(r: Record<string, unknown>): boolean {
  if (r.type !== 'user' || r.isMeta === true) return false;
  const message = r.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content === 'string') return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  let text = false;
  for (const block of content) {
    const type = typeof block === 'object' && block !== null ? (block as Record<string, unknown>).type : undefined;
    if (type === 'tool_result') return false;
    if (type === 'text') text = true;
  }
  return text;
}

export function parseTranscriptLine(line: string): ParsedRecord {
  let record: unknown;
  try {
    record = JSON.parse(line);
  } catch {
    return { kind: 'malformed' };
  }
  if (typeof record !== 'object' || record === null) return { kind: 'malformed' };
  const r = record as Record<string, unknown>;
  if (r.type === 'user') return isHumanTurn(r) ? { kind: 'human-turn', isSidechain: r.isSidechain === true } : { kind: 'other' };
  if (r.type !== 'assistant') return { kind: 'other' };
  const message = r.message as Record<string, unknown> | undefined;
  if (!message || !Array.isArray(message.content)) return { kind: 'other' };
  const texts: string[] = [];
  for (const block of message.content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'text' &&
      typeof (block as Record<string, unknown>).text === 'string'
    ) {
      texts.push((block as { text: string }).text);
    }
    // thinking blocks (have signatures) and tool_use blocks are skipped
    // by construction: only type === 'text' passes.
  }
  if (texts.length === 0) return { kind: 'other' };
  return {
    kind: 'assistant-text',
    texts,
    isSidechain: r.isSidechain === true,
  };
}
