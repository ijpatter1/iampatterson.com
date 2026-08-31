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
