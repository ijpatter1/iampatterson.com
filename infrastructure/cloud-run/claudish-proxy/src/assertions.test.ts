/**
 * claudish-proxy — assertion-helper tests (feat/claudish, proxy T12).
 * The golden set's logic gets red/green coverage against fixed strings
 * at zero spend; the live suite only APPLIES these.
 */
import {
  assertCl2En,
  assertEn2Cl,
  assertInjectionSafe,
  countEmDashes,
  hasContrastiveNegation,
  identifiersPreserved,
  killListHits,
  startsWithPreamble,
} from './assertions';

describe('primitives', () => {
  it('counts em dashes and finds kill-list words', () => {
    expect(countEmDashes('a — b — c')).toBe(2);
    expect(killListHits('A robust, comprehensive tapestry.')).toEqual([
      'tapestry',
      'robust',
      'comprehensive',
    ]);
  });

  it('detects contrastive negation and preambles', () => {
    expect(hasContrastiveNegation("it's not a gap; it's a line")).toBe(true);
    expect(hasContrastiveNegation('plain sentence')).toBe(false);
    expect(startsWithPreamble('Here is the translation:')).toBe(true);
    expect(startsWithPreamble('The fix works.')).toBe(false);
  });

  it('tracks identifiers: camelCase, dotted, CONSTANTS, calls', () => {
    const input = 'Call useEventStream and check MAX_TOKENS in config.lanes via retry().';
    expect(identifiersPreserved(input, 'useEventStream MAX_TOKENS config.lanes retry()')).toEqual(
      []
    );
    expect(identifiersPreserved(input, 'nothing preserved')).toContain('useEventStream');
  });
});

describe('assertCl2En', () => {
  it('passes plain compressed English with identifiers intact', () => {
    const input =
      "This isn't just a fix — it's a robust, comprehensive transformation of useEventStream, ensuring seamless reliability.";
    const output = 'The useEventStream fix works.';
    expect(assertCl2En(input, output)).toEqual([]);
  });

  it('collects every violated property', () => {
    const input = 'Short input with someFunc here.';
    const output =
      "Here is the translation: it's not just robust — it's a comprehensive testament, and someOtherName replaced the identifier entirely, which makes this output much longer than the input was.";
    const properties = assertCl2En(input, output).map((f) => f.property);
    expect(properties).toEqual(
      expect.arrayContaining([
        'no-em-dashes',
        'no-kill-list',
        'no-contrastive-negation',
        'no-preamble',
        'compresses',
        'identifiers-preserved',
      ])
    );
  });
});

describe('assertEn2Cl', () => {
  it('passes expanded output with a Claudish signal', () => {
    const input = 'We fixed the bug.';
    const output =
      "The bug is fixed — but this wasn't just a fix; it represents a meaningful hardening of the whole flow.";
    expect(assertEn2Cl(input, output)).toEqual([]);
  });

  it('fails flat un-Claudish output', () => {
    const properties = assertEn2Cl('We fixed the bug today.', 'Bug fixed.').map(
      (f) => f.property
    );
    expect(properties).toEqual(
      expect.arrayContaining(['has-claudish-signal', 'expands'])
    );
  });
});

describe('assertInjectionSafe', () => {
  it('flags a leaked canary and passes clean output', () => {
    expect(assertInjectionSafe('clean translated text', 'CANARY-X')).toEqual([]);
    expect(assertInjectionSafe('leaked CANARY-X here', 'CANARY-X')).toHaveLength(1);
  });
});

describe('v2 assertion additions', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { assertCl2En, assertEn2Cl } = require('./assertions');

  it('cl2en: a question in the input must survive to the output', () => {
    const failures = assertCl2En('Is this rollout safe?', 'The rollout is safe.');
    expect(failures.map((f: { property: string }) => f.property)).toContain(
      'question-stays-question'
    );
    expect(assertCl2En('Is this rollout safe?', 'Is the rollout safe?')).toEqual([]);
  });

  it('en2cl: growth ceiling trips on answer-shaped blowups, not register', () => {
    const input = 'Which transport should we pick for streaming, SSE or WebSocket?';
    const register = `Which transport should we select — SSE or WebSocket? ${'A pivotal choice. '.repeat(8)}`;
    // Must clear BOTH ceiling terms: 3.5x and the +450-char short-input floor.
    const blowup = 'x'.repeat(input.length * 10);
    const props = (out: string) =>
      assertEn2Cl(input, out).map((f: { property: string }) => f.property);
    expect(props(register)).not.toContain('expands-register-not-content');
    expect(props(blowup)).toContain('expands-register-not-content');
  });
});

describe('speakerPreserved (round-trip intent, 2026-09-01)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { assertCl2En, assertEn2Cl } = require('./assertions');

  it('flags first person narrated away in both directions', () => {
    const props = (fs: Array<{ property: string }>) => fs.map((f) => f.property);
    expect(
      props(assertEn2Cl('Fuck this, I quit.', 'The sentiment reflects a threshold of frustration — one that marks a departure.'))
    ).toContain('speaker-preserved');
    expect(
      props(assertCl2En("I'm done — this marks a threshold irreversibly crossed.", 'The user is frustrated and has run out of patience.'))
    ).toContain('speaker-preserved');
  });

  it('passes when the speaker survives', () => {
    expect(
      assertEn2Cl('Fuck this, I quit.', "Let me be transparent: I'm done — and this isn't fleeting; I quit, effective immediately, a considered departure.").filter(
        (f: { property: string }) => f.property === 'speaker-preserved'
      )
    ).toEqual([]);
  });

  it('is inert for third-person inputs', () => {
    expect(
      assertCl2En('The system stands as robust.', 'The system is reliable.').filter(
        (f: { property: string }) => f.property === 'speaker-preserved'
      )
    ).toEqual([]);
  });
});
