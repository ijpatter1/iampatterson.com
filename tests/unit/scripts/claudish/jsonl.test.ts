/**
 * Claudish corpus miner — parser drift-tolerance tests (feat/claudish M3).
 * Drift tolerance IS the deliverable: every fixture line here is
 * synthetic (no transcript content enters the repo, even in tests).
 */
import {
  mightBeAssistant,
  parseTranscriptLine,
} from '../../../../scripts/claudish/lib/jsonl';

const assistantLine = (content: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: 'assistant', message: { role: 'assistant', content }, ...extra });

describe('parseTranscriptLine', () => {
  it('extracts text blocks and skips thinking/tool_use', () => {
    const line = assistantLine([
      { type: 'thinking', thinking: 'internal reasoning', signature: 'CAIS...' },
      { type: 'text', text: 'Visible prose.' },
      { type: 'tool_use', id: 't1', name: 'Bash', input: {} },
      { type: 'text', text: 'More prose.' },
    ]);
    expect(parseTranscriptLine(line)).toEqual({
      kind: 'assistant-text',
      texts: ['Visible prose.', 'More prose.'],
      isSidechain: false,
    });
  });

  it('flags sidechain (subagent) records', () => {
    const line = assistantLine([{ type: 'text', text: 'sub' }], { isSidechain: true });
    const parsed = parseTranscriptLine(line);
    expect(parsed.kind).toBe('assistant-text');
    expect((parsed as { isSidechain: boolean }).isSidechain).toBe(true);
  });

  it('classifies user records, tool results, and sidecar noise as other', () => {
    const cases = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'typed by human' } }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', content: 'output' }] },
      }),
      JSON.stringify({ type: 'mode', mode: 'normal' }),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Session' }),
      JSON.stringify({ type: 'file-history-snapshot' }),
      JSON.stringify({ type: 'brand-new-future-type', payload: { anything: true } }),
    ];
    for (const line of cases) {
      expect(parseTranscriptLine(line).kind).toBe('other');
    }
  });

  it('tolerates assistant records with missing or string content (never throws)', () => {
    expect(parseTranscriptLine(JSON.stringify({ type: 'assistant' })).kind).toBe('other');
    expect(
      parseTranscriptLine(
        JSON.stringify({ type: 'assistant', message: { content: 'bare string' } })
      ).kind
    ).toBe('other');
  });

  it('counts malformed JSON without throwing', () => {
    expect(parseTranscriptLine('{not json').kind).toBe('malformed');
    expect(parseTranscriptLine('').kind).toBe('malformed');
    expect(parseTranscriptLine('null').kind).toBe('malformed');
  });

  it('prefilter keeps assistant lines and drops most others cheaply', () => {
    expect(mightBeAssistant(assistantLine([{ type: 'text', text: 'x' }]))).toBe(true);
    expect(mightBeAssistant(JSON.stringify({ type: 'mode', mode: 'normal' }))).toBe(false);
  });
});

describe('human-turn records (turn-final tagging, 2026-09-02)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const J = require('../../../../scripts/claudish/lib/jsonl') as typeof import('../../../../scripts/claudish/lib/jsonl');
  const user = (extra: Record<string, unknown>) => JSON.stringify({ type: 'user', userType: 'external', ...extra });
  it('a typed message (string content) is a human turn', () => {
    expect(J.parseTranscriptLine(user({ message: { content: 'please fix the tests' } }))).toEqual({ kind: 'human-turn', isSidechain: false });
  });
  it('a message with text blocks and no tool_result is a human turn; a tool result is not', () => {
    expect(J.parseTranscriptLine(user({ message: { content: [{ type: 'text', text: 'pasted:' }, { type: 'image' }] } })).kind).toBe('human-turn');
    expect(J.parseTranscriptLine(user({ message: { content: [{ type: 'tool_result', content: 'ok' }] } })).kind).toBe('other');
  });
  it('system-injected (isMeta) and empty user records are not human turns', () => {
    expect(J.parseTranscriptLine(user({ isMeta: true, message: { content: 'context' } })).kind).toBe('other');
    expect(J.parseTranscriptLine(user({ message: { content: '   ' } })).kind).toBe('other');
  });
  it('carries the sidechain flag', () => {
    expect(J.parseTranscriptLine(user({ isSidechain: true, message: { content: 'x' } }))).toEqual({ kind: 'human-turn', isSidechain: true });
  });
  it('mightBeHumanTurn prefilters tool results and non-user lines', () => {
    expect(J.mightBeHumanTurn(user({ message: { content: 'hi' } }))).toBe(true);
    expect(J.mightBeHumanTurn(user({ message: { content: [{ type: 'tool_result' }] } }))).toBe(false);
    expect(J.mightBeHumanTurn(JSON.stringify({ type: 'assistant' }))).toBe(false);
  });
});
