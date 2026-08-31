/**
 * claudish-proxy — cache tests (feat/claudish, proxy T4).
 */
import { cacheKey, normalizeInput, TranslationCache } from './cache';

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
