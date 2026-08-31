/**
 * Claudish translator — translation-input normalization.
 *
 * Shared spec with the proxy's cache (infrastructure/cloud-run/
 * claudish-proxy): both sides must produce identical strings for the
 * client and server caches to agree. Case and paragraph breaks are
 * preserved on purpose — normalizing them away would return another
 * input's translation. Lowercasing lives in normalizeForDetection
 * (text-stats.ts), which serves the detector, never the cache.
 */

export function normalizeTranslationInput(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[^\S\n]+/g, ' ') // collapse space/tab runs (not newlines)
    .replace(/ +\n/g, '\n') // trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n') // 3+ newlines → paragraph break
    .trim();
}
