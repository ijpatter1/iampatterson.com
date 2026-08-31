/**
 * Claudish corpus miner — scrub-rule tests (feat/claudish M3).
 * One test per rule; all fixture strings synthetic.
 */
import {
  chunkDropReason,
  scrubChunk,
  stripStructures,
} from '../../../../scripts/claudish/lib/scrub';

describe('stripStructures (REMOVE rules)', () => {
  it('removes fenced code blocks entirely', () => {
    const out = stripStructures('Before.\n```ts\nconst secretish = 1;\n```\nAfter.');
    expect(out).not.toContain('secretish');
    expect(out).toContain('Before.');
    expect(out).toContain('After.');
  });

  it('keeps identifier-like inline code, removes complex spans', () => {
    expect(stripStructures('Call `useEventStream` here')).toContain('useEventStream');
    const out = stripStructures('Run `sed -n "1,40p" | sort -u` now');
    expect(out).not.toContain('sed -n');
  });

  it('removes paths, URLs, and emails', () => {
    const out = stripStructures(
      'See /Users/someclient/dev/big-client-name/file.ts and ~/notes.md and https://internal.example/x and bob@client.com'
    );
    expect(out).not.toContain('someclient');
    expect(out).not.toContain('notes.md');
    expect(out).not.toContain('internal.example');
    expect(out).not.toContain('client.com');
  });

  it('strips markdown structure but keeps bold (a genuine tic)', () => {
    const out = stripStructures('## Heading\n- **Root cause:** the timer\n> quoted');
    expect(out).not.toContain('##');
    expect(out).not.toMatch(/^- /m);
    expect(out).toContain('**Root cause:**');
  });
});

describe('chunkDropReason (DROP rules)', () => {
  it('drops secret shapes wholesale', () => {
    expect(chunkDropReason('key is AKIAABCDEFGHIJKLMNOP ok')).toBe('secret');
    expect(chunkDropReason('token sk-abcdefghijklmnopqrstuvwx')).toBe('secret');
    expect(chunkDropReason('hash deadbeefdeadbeefdeadbeefdeadbeef')).toBe('secret');
    expect(chunkDropReason('-----BEGIN RSA PRIVATE KEY-----')).toBe('secret');
  });

  it('drops denylisted client terms', () => {
    expect(chunkDropReason('Meeting with MegaClient Corp tomorrow', ['megaclient'])).toBe(
      'denylist'
    );
  });

  it('drops 4+ digit currency amounts', () => {
    expect(chunkDropReason('The retainer is $12,500 per month')).toBe('currency');
    expect(chunkDropReason('It costs $25 per day')).toBeNull();
  });
});

describe('scrubChunk', () => {
  it('drops rather than masks, and normalizes survivors', () => {
    expect(scrubChunk('has AKIAABCDEFGHIJKLMNOP inside')).toEqual({
      text: null,
      dropReason: 'secret',
    });
    expect(scrubChunk('  clean   text  ')).toEqual({ text: 'clean text' });
  });
});
