/**
 * Claudish translator — translation-input normalization (feat/claudish M2).
 *
 * The cache key's preimage on both sides of the wire: the client cache and
 * the proxy cache must normalize identically or repeat inputs miss. Rules:
 * NFC; trim the whole input and trailing whitespace per line; collapse
 * space/tab runs to one space; collapse 3+ newlines to 2 (paragraph
 * structure changes the translation — a wrong cache hit is worse than a
 * miss); case PRESERVED (identifiers, proper nouns, ALL-CAPS emphasis are
 * semantically load-bearing — lowercase belongs to detection only).
 */
import { normalizeTranslationInput } from '@/lib/claudish/normalize';

describe('normalizeTranslationInput', () => {
  it('trims and collapses space/tab runs', () => {
    expect(normalizeTranslationInput('  a \t  b  ')).toBe('a b');
  });

  it('preserves case', () => {
    expect(normalizeTranslationInput('The API returns NULL')).toBe(
      'The API returns NULL'
    );
  });

  it('preserves single and double newlines (paragraph structure)', () => {
    expect(normalizeTranslationInput('a\nb\n\nc')).toBe('a\nb\n\nc');
  });

  it('collapses 3+ newlines to a paragraph break', () => {
    expect(normalizeTranslationInput('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('strips trailing whitespace per line', () => {
    expect(normalizeTranslationInput('a  \nb\t\nc')).toBe('a\nb\nc');
  });

  it('applies NFC', () => {
    expect(normalizeTranslationInput('cafe\u0301')).toBe('caf\u00e9');
  });

  it('is idempotent', () => {
    const messy = '  A  \t B \n\n\n\n Ć  ';
    const once = normalizeTranslationInput(messy);
    expect(normalizeTranslationInput(once)).toBe(once);
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeTranslationInput(' \n\t ')).toBe('');
  });
});
