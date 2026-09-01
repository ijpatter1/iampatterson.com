/**
 * Provenance memo — the page remembers its own translations.
 *
 * Third deterministic layer of the round-trip fix (2026-09-01): when a
 * visitor pastes a recent translation output back into the input, the
 * detector reports the side we KNOW it belongs to — a cl2en output is
 * English by construction, an en2cl output is Claudish by construction
 * — instead of consulting a model that provably cannot separate
 * register-stripped content twins (the r8 contrastive sweep scored its
 * own training negatives at mean 0.75; see the session handoff).
 *
 * Session-local and in-memory only: nothing persists, nothing leaves
 * the page. Keyed on the same normalization detection uses, so
 * whitespace and unicode drift between copy and paste still match.
 */
import { normalizeForDetection } from './text-stats';

export type ProvenanceLang = 'en' | 'en-x-claudish';

const CAP = 50;
const MIN_CHARS = 24; // below this, provenance is as ambiguous as detection

/** Insertion-ordered: Map iteration order gives us LRU eviction. */
const memo = new Map<string, ProvenanceLang>();

function keyOf(text: string): string {
  return normalizeForDetection(text);
}

/** Record a completed translation output and the side it belongs to. */
export function noteTranslation(direction: 'en2cl' | 'cl2en', output: string): void {
  const key = keyOf(output);
  if (key.length < MIN_CHARS) return;
  const lang: ProvenanceLang = direction === 'cl2en' ? 'en' : 'en-x-claudish';
  memo.delete(key); // refresh recency on re-note
  memo.set(key, lang);
  if (memo.size > CAP) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
}

/** The known side of a recently produced translation, or null. */
export function lookupProvenance(text: string): ProvenanceLang | null {
  const key = keyOf(text);
  if (key.length < MIN_CHARS) return null;
  return memo.get(key) ?? null;
}

/** Test seam. */
export function resetProvenance(): void {
  memo.clear();
}
