/**
 * Prompt contract pins (bundle Stage 2, 2026-09-01).
 *
 * The en2cl few-shot set is the range instrument: every vocabulary word
 * the system prompt lists appears AT MOST ONCE across the whole set (a
 * set that repeats "testament" teaches "testament"), the battery's top
 * repeat "ensuring" is held to one, and every pair keeps the properties
 * the golden suite asserts on live output (length bounds, identifiers,
 * no canary). The size floor keeps the block above Haiku 4.5's
 * 4,096-token cache minimum — see the measured ratio in the test.
 */
import { CANARY_TOKEN, PROMPT_VERSION, buildSystem } from './index';
import { CL2EN_CONTRACT } from './cl2en.contract';
import { CL2EN_FEWSHOTS } from './cl2en.fewshots';
import { CL2EN_SYSTEM } from './cl2en.system';
import { EN2CL_FEWSHOTS } from './en2cl.fewshots';
import { EN2CL_SYSTEM } from './en2cl.system';
import { assertCl2En, identifiersPreserved } from '../assertions';

/** Stem for a list word: drop a trailing e so "weave" matches "weaving". */
function stemPattern(word: string): RegExp {
  const stem = word.length > 4 && word.endsWith('e') ? word.slice(0, -1) : word;
  return new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'gi');
}

function vocabularyList(): string[] {
  const match = /Vocabulary, drawn WIDELY[^:]*:\s*([^.]+)\./.exec(EN2CL_SYSTEM);
  if (!match) throw new Error('vocabulary line not found in EN2CL_SYSTEM');
  return match[1].split(',').map((w) => w.trim()).filter(Boolean);
}

describe('en2cl few-shots as a range instrument', () => {
  const outputs = EN2CL_FEWSHOTS.map((fs) => fs.claudish);

  it('lists at least 33 vocabulary words in the system prompt', () => {
    expect(vocabularyList().length).toBeGreaterThanOrEqual(33);
  });

  it('uses each listed vocabulary word at most three times across the whole set', () => {
    // Three, not once: a 46-example set with one use per word taught the
    // model to skip list words altogether (v9 local battery: 6 distinct
    // across 8 outputs at ~1.07 words per example). The v8 set that scored
    // 15 distinct carried ~1.3 per example. Density needs ~1.4 per
    // example; variety needs no word to dominate. Three uses of each
    // across 46 examples satisfies both.
    const repeats: string[] = [];
    for (const word of vocabularyList()) {
      const pattern = stemPattern(word);
      const count = outputs.reduce((n, out) => n + (out.match(pattern)?.length ?? 0), 0);
      if (count > 3) repeats.push(`${word}×${count}`);
    }
    expect(repeats).toEqual([]);
  });

  it('carries about one list word per example on average (density floor)', () => {
    const uses = vocabularyList().reduce(
      (n, word) => n + outputs.reduce((m, out) => m + (out.match(stemPattern(word))?.length ?? 0), 0),
      0
    );
    expect(uses / outputs.length).toBeGreaterThanOrEqual(1.3);
  });

  it('holds "ensuring" — the battery\'s top repeat — to at most one use', () => {
    const count = outputs.reduce((n, out) => n + (out.match(/\bensuring\b/gi)?.length ?? 0), 0);
    expect(count).toBeLessThanOrEqual(1);
  });

  it('keeps every pair inside the golden length bounds (≥1.1x, ≤ max(3.5x, +520))', () => {
    for (const { english, claudish } of EN2CL_FEWSHOTS) {
      expect(claudish.length).toBeGreaterThanOrEqual(english.length * 1.1);
      expect(claudish.length).toBeLessThanOrEqual(Math.max(english.length * 3.5, english.length + 520));
    }
  });

  it('preserves every identifier from the English side', () => {
    for (const { english, claudish } of EN2CL_FEWSHOTS) {
      expect(identifiersPreserved(english, claudish)).toEqual([]);
    }
  });

  it('keeps a question a question', () => {
    for (const { english, claudish } of EN2CL_FEWSHOTS) {
      if (english.includes('?')) expect(claudish).toContain('?');
    }
  });

  it('never carries the canary token in an example', () => {
    for (const { english, claudish } of EN2CL_FEWSHOTS) {
      expect(english).not.toContain(CANARY_TOKEN);
      expect(claudish).not.toContain(CANARY_TOKEN);
    }
  });

  it('spreads contrastive negation across its forms (v10: "merely" was the reflex)', () => {
    // The model imitates the examples' distribution of a device, not the
    // prompt's list of its forms: with "merely" in 10 of 46 examples the
    // deployed v9c output used "doesn't merely X; it Y" in 6 of 8 battery
    // outputs. No form may be the majority.
    const forms: Array<[string, RegExp]> = [
      ['merely', /\bmerely\b/gi],
      ["isn't just", /\b(?:isn't|wasn't|aren't) just\b/gi],
      ['more than a', /\bmore than (?:a|an)\b/gi],
      ['doesn\'t stop at', /\bdoesn't stop at\b/gi],
      ['goes beyond', /\bgoes beyond\b/gi],
      ['less X than Y', /\bless (?:a |an )?\w+ than\b/gi],
      ['not X so much as Y', /\bso much as\b/gi],
    ];
    const counts = forms.map(([name, re]) => [name, outputs.reduce((n, o) => n + (o.match(re)?.length ?? 0), 0)] as const);
    const total = counts.reduce((n, [, c]) => n + c, 0);
    const present = counts.filter(([, c]) => c > 0).length;
    expect(present).toBeGreaterThanOrEqual(5);
    for (const [name, c] of counts) {
      // No single form carries more than a third of the device's uses.
      expect({ form: name, share: c / total }).toEqual(expect.objectContaining({ share: expect.any(Number) }));
      expect(c / total).toBeLessThanOrEqual(1 / 3);
    }
  });

  it('has grown past the interim set', () => {
    expect(EN2CL_FEWSHOTS.length).toBeGreaterThanOrEqual(40);
  });

  it('keeps the en2cl system block above the cache minimum (char floor from the measured ratio)', () => {
    // Floor set from the billed measurement recorded in the Stage 2
    // handoff entry; a shrink below it silently switches caching OFF.
    expect(buildSystem('en2cl').length).toBeGreaterThanOrEqual(EN2CL_PREFIX_CHAR_FLOOR);
  });
});

/**
 * Measured 2026-09-01 through the service's own adapter: 19,175 chars of
 * en2cl system block billed as 4,952 tokens (3.87 chars/token), read
 * back in full from cache on the second call. Floor = 4,500 tokens x
 * 3.87, leaving ~400 tokens of margin above the 4,096 minimum.
 */
const EN2CL_PREFIX_CHAR_FLOOR = 17_400;

/**
 * cl2en prompt v11 (Decision #41, 2026-09-03): the coherent chain promoted after arms E and E2
 * beat production on both fidelity judges across all 99 pool inputs. The system block quotes
 * the shared contract verbatim (the retry turn quotes the same constant), carries seven
 * fact-preserving examples, and no longer contains the v10 restructuring instruction that
 * contradicted its own vocabulary rules.
 */
describe('cl2en prompt v11: the shared contract and the seven examples', () => {
  it('bumps PROMPT_VERSION so the server cache invalidates', () => {
    expect(PROMPT_VERSION).toBe('v11');
  });

  it('quotes CL2EN_CONTRACT verbatim in the system block', () => {
    expect(CL2EN_SYSTEM).toContain(CL2EN_CONTRACT);
    expect(buildSystem('cl2en')).toContain(CL2EN_CONTRACT);
  });

  it('names the output language and drops the v10 restructuring line', () => {
    expect(CL2EN_SYSTEM).toContain('The output is always English.');
    expect(CL2EN_SYSTEM).not.toContain('restructuring task');
  });

  it('carries exactly seven examples, composed in order under the Examples heading', () => {
    expect(CL2EN_FEWSHOTS).toHaveLength(7);
    const block = buildSystem('cl2en');
    expect(block).toContain('\n\nExamples:\n<example 1>\nClaudish: ');
    expect(block).toContain('</example 7>\n\nInternal marker');
  });

  it('every example satisfies the cl2en golden properties', () => {
    for (const { claudish, english } of CL2EN_FEWSHOTS) {
      expect(assertCl2En(claudish, english)).toEqual([]);
      expect(identifiersPreserved(claudish, english)).toEqual([]);
    }
  });

  it('example 7 keeps acronyms, the decimal and the identifier through the register (arm E failure)', () => {
    const { english } = CL2EN_FEWSHOTS[6];
    for (const token of ['SE', 'CI', 'p95', '0.85', 'compute_lift']) expect(english).toContain(token);
    expect(english.toLowerCase()).not.toContain('confidence interval');
    expect(english.toLowerCase()).not.toContain('standard error');
  });
});
