/**
 * Provenance memo tests — the third deterministic layer of the
 * round-trip fix (2026-09-01). The page remembers what it translated;
 * pasting a recent output back reports the known side instead of
 * asking a model that provably cannot separate register-stripped
 * content from its source (see the r8 contrastive sweep record).
 */
import { lookupProvenance, noteTranslation, resetProvenance } from '@/lib/claudish/provenance';

describe('provenance memo', () => {
  beforeEach(() => resetProvenance());

  it('remembers a cl2en output as English', () => {
    noteTranslation('cl2en', 'The fix shipped and the tests pass.');
    expect(lookupProvenance('The fix shipped and the tests pass.')).toBe('en');
  });

  it('remembers an en2cl output as Claudish', () => {
    noteTranslation('en2cl', "The fix didn't just ship — it landed, a testament to rigor.");
    expect(lookupProvenance("The fix didn't just ship — it landed, a testament to rigor.")).toBe(
      'en-x-claudish',
    );
  });

  it('matches through whitespace and unicode normalization differences', () => {
    noteTranslation('cl2en', 'The fix shipped.\nThe tests pass.');
    expect(lookupProvenance('  The fix shipped. The tests  pass. ')).toBe('en');
  });

  it('returns null for unknown text', () => {
    noteTranslation('cl2en', 'The fix shipped.');
    expect(lookupProvenance('A completely different sentence about soup.')).toBeNull();
  });

  it('ignores empty and trivially short outputs', () => {
    noteTranslation('cl2en', '  ');
    noteTranslation('cl2en', 'ok');
    expect(lookupProvenance('  ')).toBeNull();
    expect(lookupProvenance('ok')).toBeNull();
  });

  it('evicts oldest entries beyond the cap, keeps recent ones', () => {
    for (let i = 0; i < 60; i++) {
      noteTranslation('cl2en', `Translation number ${i} of the evening, still plain English.`);
    }
    expect(
      lookupProvenance('Translation number 0 of the evening, still plain English.'),
    ).toBeNull();
    expect(lookupProvenance('Translation number 59 of the evening, still plain English.')).toBe(
      'en',
    );
  });

  it('a re-noted text refreshes recency instead of duplicating', () => {
    noteTranslation('cl2en', 'The fix shipped tonight.');
    for (let i = 0; i < 49; i++) {
      noteTranslation('cl2en', `Filler translation ${i} to press on the cap.`);
    }
    noteTranslation('cl2en', 'The fix shipped tonight.'); // refresh
    for (let i = 0; i < 10; i++) {
      noteTranslation('cl2en', `More filler ${i} pushing eviction.`);
    }
    expect(lookupProvenance('The fix shipped tonight.')).toBe('en');
  });
});
