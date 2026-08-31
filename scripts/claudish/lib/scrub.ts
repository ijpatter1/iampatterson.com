/**
 * Claudish corpus miner — scrub pipeline.
 *
 * Privacy is the point: directory names ARE client names, and prose can
 * carry paths, secrets, and money. Two kinds of rule:
 *  - REMOVE (code fences, non-identifier inline code, paths, URLs,
 *    emails, markdown structure): the chunk survives without the match.
 *  - DROP (secret shapes, denylist terms, 4+ digit currency): the WHOLE
 *    chunk dies — a masked chunk still leaks the sentence around the hit.
 * Applied to training text, the lexicon, and anything that ships;
 * committed JSON is re-checked by a Jest scrub-invariant test.
 */

export const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{36}/,
  /eyJ[A-Za-z0-9_-]{20,}\./, // JWT-ish
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[0-9a-fA-F]{32,}\b/, // long hex runs (hashes, keys)
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/, // long base64 runs
];

/** Currency with 4+ digits (client financials) drops the chunk. */
const CURRENCY_PATTERN = /[$€£]\s?\d{1,3}(?:,\d{3})+|[$€£]\s?\d{4,}/;

const BARE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9 _.-]{0,24}$/;

export type DropReason = 'secret' | 'denylist' | 'currency';

export interface ScrubResult {
  text: string | null;
  dropReason?: DropReason;
}

/** Stage 1 (REMOVE rules) — applied to whole messages before chunking. */
export function stripStructures(text: string): string {
  let out = text;
  // Fenced code blocks (and their contents) go entirely.
  out = out.replace(/```[\s\S]*?```/g, ' ');
  // 4-space-indented code lines.
  out = out.replace(/^(?: {4}|\t).*$/gm, ' ');
  // Inline code spans: keep content only when it reads as a bare identifier.
  out = out.replace(/`([^`\n]*)`/g, (_m, inner: string) =>
    BARE_IDENTIFIER.test(inner) ? inner : ' '
  );
  // Paths: home-relative, absolute POSIX (2+ segments), Windows, bare file.ext tokens.
  out = out.replace(/~\/[\w./@%+-]+/g, ' ');
  out = out.replace(/(?:\/[\w.@%+-]+){2,}\/?/g, ' ');
  out = out.replace(/\b[A-Za-z]:\\[\w\\. -]+/g, ' ');
  out = out.replace(/\b[\w-]+\/[\w./-]+\.[a-z]{2,4}\b/g, ' ');
  // URLs and emails.
  out = out.replace(/https?:\/\/\S+/g, ' ');
  out = out.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, ' ');
  // Markdown structure: heading/list/blockquote markers; keep bold/italic
  // (the bold lead-in is a genuine tic users can type).
  out = out.replace(/^#{1,6}\s+/gm, '');
  out = out.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '');
  out = out.replace(/^>\s?/gm, '');
  return out;
}

/** Stage 2 (DROP rules) — applied per chunk. */
export function chunkDropReason(
  chunk: string,
  denylist: string[] = []
): DropReason | null {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(chunk)) return 'secret';
  }
  const lower = chunk.toLowerCase();
  for (const term of denylist) {
    if (term && lower.includes(term.toLowerCase())) return 'denylist';
  }
  if (CURRENCY_PATTERN.test(chunk)) return 'currency';
  return null;
}

export function scrubChunk(chunk: string, denylist: string[] = []): ScrubResult {
  const dropReason = chunkDropReason(chunk, denylist);
  if (dropReason) return { text: null, dropReason };
  const cleaned = chunk.normalize('NFC').replace(/\s+/g, ' ').trim();
  return { text: cleaned.length > 0 ? cleaned : null };
}
