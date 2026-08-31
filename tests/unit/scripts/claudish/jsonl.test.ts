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
