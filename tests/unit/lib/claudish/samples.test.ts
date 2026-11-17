/**
 * Claudish translator — the stored sample translations (21.3).
 *
 * The page opens on an example already translated, and three sample
 * phrases show their translation when tapped, with no model call. The
 * page's honesty rests on those translations being real output from the
 * live translator, generated once: so each one carries where it came
 * from (date, lane, model, prompt version), and the strings are pinned
 * here exactly as generated. Rewording one by hand would turn real output
 * into invented output; regenerate it and update the provenance instead.
 */
import { INPUT_CAP } from '@/lib/claudish/limits';
import { CLAUDISH_SAMPLES, SAMPLE_DIRECTION_LABELS, SAMPLES_HEADING } from '@/lib/claudish/samples';

/** The proxy's configured default model per lane (claudish-proxy src/config.ts). */
const LANE_DEFAULT_MODEL: Record<string, string> = {
  'anthropic-api': 'claude-haiku-5-5',
  'gemini-loop': 'gemini-3.5-flash-lite',
};

describe('CLAUDISH_SAMPLES', () => {
  it('holds three samples, one of them Claudish to English, the first English to Claudish', () => {
    expect(CLAUDISH_SAMPLES).toHaveLength(3);
    expect(CLAUDISH_SAMPLES.map((s) => s.direction)).toEqual(['en2cl', 'en2cl', 'cl2en']);
  });

  it('keeps the translations exactly as the live translator produced them on 2026-11-17', () => {
    expect(CLAUDISH_SAMPLES.map(({ source, target }) => ({ source, target }))).toEqual([
      {
        source: 'We ship on Friday.',
        target:
          'The shipping date is set in stone: we ship on Friday — a commitment that carries real weight, and one the whole team is now measured against.',
      },
      {
        source: 'I will post the numbers when we have a full quarter of data.',
        target:
          'I’ll be sharing the numbers once we have a full quarter’s worth of data — the complete picture, not a partial snapshot, and that distinction matters. Until then, the figures stay in the wings, ready to illuminate the story only when they’re whole.',
      },
      {
        source: 'Neither expressed any desire to return, which speaks volumes.',
        target: 'Neither wanted to come back, which tells you a lot.',
      },
    ]);
  });

  it('carries its source on every sample: date, lane, model and prompt version', () => {
    for (const sample of CLAUDISH_SAMPLES) {
      expect(sample.provenance.generatedOn).toBe('2026-11-17');
      expect(sample.provenance.promptVersion).toBe('v11');
      // The model is the lane's configured default, so the pair must agree.
      expect(sample.provenance.model).toBe(LANE_DEFAULT_MODEL[sample.provenance.lane]);
    }
    expect(CLAUDISH_SAMPLES.map((s) => s.provenance.lane)).toEqual([
      'anthropic-api',
      'anthropic-api',
      'gemini-loop',
    ]);
  });

  it('fits every sample in the input box, so a tap never shows text the box would cut', () => {
    for (const sample of CLAUDISH_SAMPLES) {
      expect(sample.source.length).toBeLessThanOrEqual(INPUT_CAP);
    }
  });
});

describe('sample card labels', () => {
  it('uses the approved mockup wording', () => {
    expect(SAMPLES_HEADING).toBe('Try one');
    expect(SAMPLE_DIRECTION_LABELS).toEqual({
      en2cl: 'English → Claudish',
      cl2en: 'Claudish → English',
    });
  });
});
