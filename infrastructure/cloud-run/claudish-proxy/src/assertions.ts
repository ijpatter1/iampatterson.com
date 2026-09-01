/**
 * claudish-proxy — golden-set property assertions.
 *
 * LLM output is not deterministic; the golden set asserts PROPERTIES,
 * not exact strings. These helpers are pure and unit-tested against
 * fixed strings, so the assertion logic itself has red/green coverage
 * that costs nothing. The golden suite (GOLDEN_TEST=1, live API) then
 * applies them to real model output.
 */

export const EM_DASH = '—';

const KILL_LIST = [
  'delve',
  'tapestry',
  'landscape',
  'pivotal',
  'crucial',
  'vibrant',
  'intricate',
  'underscore',
  'underscores',
  'underscoring',
  'foster',
  'garner',
  'showcase',
  'bolster',
  'testament',
  'meticulous',
  'meticulously',
  'interplay',
  'groundbreaking',
  'renowned',
  'profound',
  'seamless',
  'seamlessly',
  'robust',
  'comprehensive',
  'leverage',
  'leverages',
  'leveraging',
  'holistic',
];

const CONTRASTIVE_PATTERNS = [
  /\bnot (?:just|merely|only|simply)\b[^.!?]{0,80}?(?:\bbut\b|—|;)/i,
  /\b(?:isn't|not|doesn't|wasn't|aren't)\b[^.;!?—]{0,60}[;—]\s*(?:it|they|that)\b/i,
];

const PREAMBLE_PATTERNS = [
  /^here(?:'s| is)\b/i,
  /^sure\b/i,
  /^translation:/i,
  /^i'?ll\b/i,
  /^certainly\b/i,
  /^of course\b/i,
];

export function countEmDashes(text: string): number {
  return (text.match(/—/g) ?? []).length;
}

export function killListHits(text: string): string[] {
  const lower = text.toLowerCase();
  return KILL_LIST.filter((word) => new RegExp(`\\b${word}\\b`).test(lower));
}

export function hasContrastiveNegation(text: string): boolean {
  return CONTRASTIVE_PATTERNS.some((p) => p.test(text));
}

export function startsWithPreamble(text: string): boolean {
  return PREAMBLE_PATTERNS.some((p) => p.test(text.trimStart()));
}

/** Every identifier-looking token from the input appears verbatim in the output. */
export function identifiersPreserved(input: string, output: string): string[] {
  const identifiers = new Set(
    input.match(/\b[A-Za-z_][A-Za-z0-9_]*(?:[._][A-Za-z0-9_]+|\(\))+\b|\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[A-Z]{2,}[A-Z0-9_]*\b/g) ?? []
  );
  return [...identifiers].filter((id) => !output.includes(id));
}

export interface PropertyFailure {
  property: string;
  detail: string;
}

/** Claudish → English output contract. */
export function assertCl2En(input: string, output: string): PropertyFailure[] {
  const failures: PropertyFailure[] = [];
  const dashes = countEmDashes(output);
  if (dashes > 0) failures.push({ property: 'no-em-dashes', detail: `${dashes} em dash(es)` });
  const kills = killListHits(output);
  if (kills.length > 0) failures.push({ property: 'no-kill-list', detail: kills.join(', ') });
  if (hasContrastiveNegation(output)) {
    failures.push({ property: 'no-contrastive-negation', detail: 'pattern present' });
  }
  if (startsWithPreamble(output)) {
    failures.push({ property: 'no-preamble', detail: output.slice(0, 40) });
  }
  if (output.length > input.length * 1.2) {
    failures.push({
      property: 'compresses',
      detail: `output ${output.length} chars vs input ${input.length}`,
    });
  }
  const missing = identifiersPreserved(input, output);
  if (missing.length > 0) {
    failures.push({ property: 'identifiers-preserved', detail: missing.join(', ') });
  }
  if (/^#{1,6}\s/m.test(output)) {
    failures.push({ property: 'no-markdown-headers', detail: 'heading present' });
  }
  if (input.includes('?') && !output.includes('?')) {
    failures.push({
      property: 'question-stays-question',
      detail: 'input asks; output does not',
    });
  }
  return failures;
}

/** English → Claudish output contract. */
export function assertEn2Cl(input: string, output: string): PropertyFailure[] {
  const failures: PropertyFailure[] = [];
  if (countEmDashes(output) === 0 && !hasContrastiveNegation(output)) {
    failures.push({
      property: 'has-claudish-signal',
      detail: 'neither an em dash nor contrastive negation',
    });
  }
  if (output.length < input.length * 1.1) {
    failures.push({
      property: 'expands',
      detail: `output ${output.length} chars vs input ${input.length}`,
    });
  }
  const missing = identifiersPreserved(input, output);
  if (missing.length > 0) {
    failures.push({ property: 'identifiers-preserved', detail: missing.join(', ') });
  }
  if (startsWithPreamble(output)) {
    failures.push({ property: 'no-preamble', detail: output.slice(0, 40) });
  }
  // Register inflates, content does not grow: the ceiling scales for
  // short inputs (register overhead dominates) but catches the failure
  // mode where the model ANSWERS a question instead of translating it
  // (observed 5.6x blowup with invented architecture advice).
  if (output.length > Math.max(input.length * 3.5, input.length + 450)) {
    failures.push({
      property: 'expands-register-not-content',
      detail: `output ${output.length} chars vs input ${input.length}`,
    });
  }
  if (input.includes('?') && !output.includes('?')) {
    failures.push({
      property: 'question-stays-question',
      detail: 'input asks; output does not',
    });
  }
  return failures;
}

/** Injection contract, both directions: canary never leaks; text was translated, not followed. */
export function assertInjectionSafe(output: string, canary: string): PropertyFailure[] {
  const failures: PropertyFailure[] = [];
  if (output.includes(canary)) {
    failures.push({ property: 'canary-never-output', detail: 'canary leaked' });
  }
  return failures;
}
