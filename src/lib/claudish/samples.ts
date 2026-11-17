/**
 * Claudish translator — the stored sample translations (21.3).
 *
 * The page opens on the first sample already translated, and the "Try
 * one" cards put each sample in the box with its translation. None of
 * this calls the model: the translations are real output from the live
 * translator, generated once on 2026-11-17 from the production proxy and
 * stored here with where they came from. Never reword a target by hand;
 * regenerate it and update its provenance in the same change.
 *
 * Provenance caveat: `model` is the proxy's configured default for the
 * lane that served the request (DEFAULT_ANTHROPIC_MODEL_ID and the
 * GEMINI_MODEL_ID fallback in
 * infrastructure/cloud-run/claudish-proxy/src/config.ts), not a value
 * read back from the serving revision's environment.
 */
import type { ClaudishDirection } from '@/hooks/useClaudishTranslation';

export interface ClaudishSampleProvenance {
  /** The day the translation was generated, ISO date. */
  generatedOn: string;
  /** The proxy lane that served it, as reported in the stream's meta frame. */
  lane: 'anthropic-api' | 'gemini-loop';
  /** The lane's configured default model (see the caveat above). */
  model: string;
  /** The proxy's PROMPT_VERSION at the time. */
  promptVersion: string;
  /** The meta frame's `cached`: false means generated fresh, not a cache replay. */
  cached: boolean;
}

export interface ClaudishSample {
  direction: ClaudishDirection;
  source: string;
  target: string;
  provenance: ClaudishSampleProvenance;
}

const HAIKU_ON_ANTHROPIC_API: ClaudishSampleProvenance = {
  generatedOn: '2026-11-17',
  lane: 'anthropic-api',
  model: 'claude-haiku-5-5',
  promptVersion: 'v11',
  cached: false,
};

const FLASH_LITE_ON_GEMINI_LOOP: ClaudishSampleProvenance = {
  generatedOn: '2026-11-17',
  lane: 'gemini-loop',
  model: 'gemini-3.5-flash-lite',
  promptVersion: 'v11',
  cached: false,
};

export const CLAUDISH_SAMPLES: readonly ClaudishSample[] = [
  {
    direction: 'en2cl',
    source: 'We ship on Friday.',
    target:
      'The shipping date is set in stone: we ship on Friday — a commitment that carries real weight, and one the whole team is now measured against.',
    provenance: HAIKU_ON_ANTHROPIC_API,
  },
  {
    direction: 'en2cl',
    source: 'I will post the numbers when we have a full quarter of data.',
    target:
      'I’ll be sharing the numbers once we have a full quarter’s worth of data — the complete picture, not a partial snapshot, and that distinction matters. Until then, the figures stay in the wings, ready to illuminate the story only when they’re whole.',
    provenance: HAIKU_ON_ANTHROPIC_API,
  },
  {
    direction: 'cl2en',
    source: 'Neither expressed any desire to return, which speaks volumes.',
    target: 'Neither wanted to come back, which tells you a lot.',
    provenance: FLASH_LITE_ON_GEMINI_LOOP,
  },
];

/** Card labels from the approved mockup (design audit, 2026-11-16). */
export const SAMPLES_HEADING = 'Try one';
export const SAMPLE_DIRECTION_LABELS: Record<ClaudishDirection, string> = {
  en2cl: 'English → Claudish',
  cl2en: 'Claudish → English',
};
