/**
 * Claudish translator — text statistics.
 *
 * countChars deliberately measures UTF-16 code units (String.length) so the
 * visible counter, the textarea maxLength, and the proxy's server-side cap
 * all enforce the same number. countEmDashes counts U+2014 only.
 * normalizeForDetection is shared with the CCLD featurizer: NFC, lowercase,
 * whitespace runs collapsed to a single space, trimmed. Em dashes and all
 * other punctuation survive — punctuation habits are the detection signal.
 */

const EM_DASH = '—';

export function countEmDashes(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === EM_DASH) count++;
  }
  return count;
}

/** UTF-16 code units, matching textarea maxLength and the proxy input cap. */
export function countChars(text: string): number {
  return text.length;
}

export function normalizeForDetection(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}
