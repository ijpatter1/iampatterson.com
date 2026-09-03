/**
 * claudish-proxy — cache tests (feat/claudish, proxy T4).
 */
import { cacheKey, cacheableTranslation, normalizeInput, TranslationCache } from './cache';

describe('normalizeInput (must mirror the frontend normalize.ts)', () => {
  it('collapses spaces, preserves case and paragraph breaks', () => {
    expect(normalizeInput('  The  API \t returns NULL \n\n\n\nnext  ')).toBe(
      'The API returns NULL\n\nnext'
    );
  });
  it('is idempotent and NFC-normalized', () => {
    expect(normalizeInput('café')).toBe('café');
    const once = normalizeInput('  A \n\n\n B ');
    expect(normalizeInput(once)).toBe(once);
  });
});

describe('cacheKey', () => {
  it('changes with direction, prompt version, model, and input', () => {
    const base = cacheKey('en2cl', 'v1', 'model-a', 'text');
    expect(cacheKey('cl2en', 'v1', 'model-a', 'text')).not.toBe(base);
    expect(cacheKey('en2cl', 'v2', 'model-a', 'text')).not.toBe(base);
    expect(cacheKey('en2cl', 'v1', 'model-b', 'text')).not.toBe(base);
    expect(cacheKey('en2cl', 'v1', 'model-a', 'other')).not.toBe(base);
    expect(cacheKey('en2cl', 'v1', 'model-a', 'text')).toBe(base);
    expect(base).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('TranslationCache', () => {
  it('stores, retrieves, and expires by TTL', () => {
    const cache = new TranslationCache(10, 1000);
    cache.set('k', 'value', 0);
    expect(cache.get('k', 999)).toBe('value');
    expect(cache.get('k', 1000)).toBeUndefined();
  });

  it('evicts the least recently used at capacity', () => {
    const cache = new TranslationCache(2, 10000);
    cache.set('a', '1', 0);
    cache.set('b', '2', 0);
    cache.get('a', 1);
    cache.set('c', '3', 2);
    expect(cache.get('b', 3)).toBeUndefined();
    expect(cache.get('a', 3)).toBe('1');
    expect(cache.get('c', 3)).toBe('3');
  });

  it('skips oversized values rather than truncating', () => {
    const cache = new TranslationCache(10, 1000, 8);
    cache.set('k', 'way more than eight bytes', 0);
    expect(cache.get('k', 1)).toBeUndefined();
  });
});

describe('cacheableTranslation (echo guard, 2026-09-01)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { cacheableTranslation, normalizeInput } = require('./cache');

  it('refuses to cache an output that echoes the input', () => {
    const input = normalizeInput('This is — extremely — Claudish text.');
    expect(cacheableTranslation('cl2en', input, 'This is — extremely — Claudish text.')).toBe(false);
    expect(cacheableTranslation('en2cl', input, 'This is — extremely — Claudish text.')).toBe(false);
  });

  it('refuses to cache cl2en output still carrying em dashes', () => {
    const input = normalizeInput('The plan — such as it is — ships tomorrow.');
    expect(cacheableTranslation('cl2en', input, 'The plan ships tomorrow — such as it is.')).toBe(
      false
    );
  });

  it('caches clean translations in both directions', () => {
    expect(
      cacheableTranslation('cl2en', normalizeInput('It stands as a pivotal fix — truly.'), 'It is a fix.')
    ).toBe(true);
    expect(
      cacheableTranslation('en2cl', normalizeInput('We fixed it.'), "We fixed it — and this isn't just a patch; it's a commitment.")
    ).toBe(true);
  });

  it('allows en2cl output to keep em dashes (the register requires them)', () => {
    expect(
      cacheableTranslation('en2cl', normalizeInput('Ship it.'), 'Ship it — a pivotal moment.')
    ).toBe(true);
  });
});

describe('echo gate parity with the smoother (review batch 2, 2026-09-03)', () => {
  it('catches an echo whose single-spaced dash the smoother rewrites differently', () => {
    expect(cacheableTranslation('cl2en', normalizeInput('We shipped \u2014fast.'), 'We shipped, fast.')).toBe(false);
  });
  it('catches an echo whose bold the smoother stripped', () => {
    expect(cacheableTranslation('cl2en', normalizeInput('**We** shipped fast.'), 'We shipped fast.')).toBe(false);
  });
  it('still accepts a real translation', () => {
    expect(cacheableTranslation('cl2en', normalizeInput('We shipped \u2014fast.'), 'We shipped quickly.')).toBe(true);
  });
});
