/**
 * claudish-proxy — logging redaction tests (feat/claudish, proxy T3).
 * The redaction contract is enforced here, not by discipline.
 */
import { hashIp, logEvent, redactError, setLogSink } from './log';

const SECRET_INPUT = 'my confidential business plan — never log';

let lines: string[];
beforeEach(() => {
  lines = [];
  setLogSink((l) => lines.push(l));
});

describe('logEvent', () => {
  it('emits allowed fields as one JSON line', () => {
    logEvent('INFO', 'translate_done', {
      requestId: 'r1',
      direction: 'en2cl',
      lane: 'vertex-global',
      inputChars: 42,
      ttftMs: 400,
    });
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toMatchObject({
      severity: 'INFO',
      event: 'translate_done',
      lane: 'vertex-global',
      inputChars: 42,
    });
  });

  it('drops fields outside the allowlist loudly', () => {
    logEvent('INFO', 'oops', {
      // Deliberate misuse: a free-text field outside the allowlist.
      text: SECRET_INPUT,
      inputChars: 10,
    });
    const parsed = JSON.parse(lines[0]);
    expect(JSON.stringify(parsed)).not.toContain(SECRET_INPUT);
    expect(parsed.droppedFields).toContain('text');
  });
});

describe('redactError', () => {
  it('keeps the constructor name and status only', () => {
    class BadRequestError extends Error {
      status = 400;
    }
    const err = new BadRequestError(`upstream rejected: ${SECRET_INPUT}`);
    const red = redactError(err);
    expect(red).toEqual({ errorName: 'BadRequestError', httpStatus: 400 });
    expect(JSON.stringify(red)).not.toContain(SECRET_INPUT);
  });

  it('handles non-Error throwables', () => {
    expect(redactError('boom')).toEqual({ errorName: 'string' });
  });
});

describe('hashIp', () => {
  it('is stable within a process and 8 hex chars', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
    expect(hashIp('1.2.3.4')).toMatch(/^[0-9a-f]{8}$/);
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'));
  });
});
