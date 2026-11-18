/**
 * @jest-environment jsdom
 *
 * Claudish translator — measurement events (feat/claudish M2, phase B).
 *
 * Four events: claudish_translate (one per terminal outcome, with an
 * outcome discriminator — aborts never fire), claudish_detected (once per
 * session per language, gated by the caller), claudish_share (copy folds
 * in as copy_output; opened_shared_link closes the loop), claudish_rate.
 *
 * The guardrail pin here is the one that matters: NO event payload may
 * carry the input or output text. Params are counts, durations, enums,
 * and booleans only — "no input bodies logged" extends to analytics.
 */
import {
  trackClaudishDetected,
  trackClaudishRate,
  trackClaudishSamplePick,
  trackClaudishShare,
  trackClaudishTranslate,
} from '@/lib/events/track';

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-session-id' },
});

beforeEach(() => {
  window.dataLayer = [];
  document.cookie = '_iap_sid=; Max-Age=0; Path=/';
  document.cookie = '_iap_aid=; Max-Age=0; Path=/';
});

describe('trackClaudishTranslate', () => {
  it('pushes a complete translation with timing, size, and cache facts', () => {
    trackClaudishTranslate({
      direction: 'en_to_claudish',
      source_mode: 'auto',
      detected_language: 'en',
      detector_source: 'heuristic',
      outcome: 'complete',
      input_chars: 42,
      input_em_dashes: 0,
      output_chars: 118,
      ttft_ms: 412,
      duration_ms: 1930,
      cache: 'miss',
    });
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'claudish_translate',
      direction: 'en_to_claudish',
      outcome: 'complete',
      input_chars: 42,
      ttft_ms: 412,
      cache: 'miss',
      session_id: 'test-session-id',
      iap_source: true,
    });
  });

  it('pushes refusals with zero output', () => {
    trackClaudishTranslate({
      direction: 'claudish_to_en',
      source_mode: 'auto',
      detected_language: 'en-x-claudish',
      detector_source: 'ccld',
      outcome: 'refused',
      input_chars: 300,
      input_em_dashes: 4,
      output_chars: 0,
      ttft_ms: 0,
      duration_ms: 800,
      cache: 'miss',
    });
    expect(window.dataLayer[0]).toMatchObject({
      event: 'claudish_translate',
      outcome: 'refused',
      output_chars: 0,
    });
  });
});

describe('trackClaudishDetected', () => {
  it('pushes the detected language with detector provenance', () => {
    trackClaudishDetected({
      detected_language: 'en-x-claudish',
      detector_source: 'heuristic',
      input_chars: 96,
    });
    expect(window.dataLayer[0]).toMatchObject({
      event: 'claudish_detected',
      detected_language: 'en-x-claudish',
      detector_source: 'heuristic',
      input_chars: 96,
    });
  });
});

describe('trackClaudishShare', () => {
  it('pushes share actions including the copy fold-in', () => {
    trackClaudishShare({
      share_action: 'copy_output',
      direction: 'en_to_claudish',
      output_chars: 240,
      share_truncated: false,
      share_url_chars: 0,
      from_sample: false,
    });
    expect(window.dataLayer[0]).toMatchObject({
      event: 'claudish_share',
      share_action: 'copy_output',
      share_truncated: false,
    });
  });

  it('pushes the shared-link-opened end of the loop', () => {
    trackClaudishShare({
      share_action: 'opened_shared_link',
      direction: 'claudish_to_en',
      output_chars: 512,
      share_truncated: true,
      share_url_chars: 1720,
      from_sample: false,
    });
    expect(window.dataLayer[0]).toMatchObject({
      event: 'claudish_share',
      share_action: 'opened_shared_link',
      share_url_chars: 1720,
    });
  });
});

describe('trackClaudishRate', () => {
  it('pushes both thumb ratings', () => {
    trackClaudishRate({
      rating: 'absolutely_right',
      direction: 'en_to_claudish',
      output_chars: 300,
      from_sample: false,
    });
    expect(window.dataLayer[0]).toMatchObject({
      event: 'claudish_rate',
      rating: 'absolutely_right',
    });
  });
});

describe('the samples are measured apart from live translations (22.1)', () => {
  // Without this, every visitor's first rating can be of a fixed example,
  // and the share and rate numbers would credit the model for stored text.
  it('a card tap pushes its number and direction, and nothing else of its own', () => {
    trackClaudishSamplePick({ sample_index: 3, direction: 'claudish_to_en' });
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'claudish_sample_pick',
      sample_index: 3,
      direction: 'claudish_to_en',
    });
  });

  it('share and rate carry from_sample, so a stored example is told apart', () => {
    trackClaudishShare({
      share_action: 'copy_output',
      direction: 'en_to_claudish',
      output_chars: 120,
      share_truncated: false,
      share_url_chars: 0,
      from_sample: true,
    });
    trackClaudishRate({
      rating: 'holds_up',
      direction: 'en_to_claudish',
      output_chars: 120,
      from_sample: true,
    });
    expect(window.dataLayer.map((e) => (e as { from_sample?: boolean }).from_sample)).toEqual([
      true,
      true,
    ]);
  });
});

describe('guardrail: no text in any claudish payload', () => {
  it('emits only numbers, booleans, and closed-enum strings as claudish params', () => {
    const SOURCE = 'my secret business plan — do not log this';
    const TARGET = 'the translated secret — never in analytics';
    // Fire every claudish event the way the UI would, with the real text
    // nearby in scope, then assert none of it reached the dataLayer.
    trackClaudishTranslate({
      direction: 'en_to_claudish',
      source_mode: 'manual',
      detected_language: 'none',
      detector_source: 'heuristic',
      outcome: 'complete',
      input_chars: SOURCE.length,
      input_em_dashes: 1,
      output_chars: TARGET.length,
      ttft_ms: 500,
      duration_ms: 1500,
      cache: 'client',
    });
    trackClaudishDetected({
      detected_language: 'en',
      detector_source: 'ccld',
      input_chars: SOURCE.length,
    });
    trackClaudishShare({
      share_action: 'copy_link',
      direction: 'en_to_claudish',
      output_chars: TARGET.length,
      share_truncated: false,
      share_url_chars: 400,
      from_sample: false,
    });
    trackClaudishRate({
      rating: 'holds_up',
      direction: 'en_to_claudish',
      output_chars: TARGET.length,
      from_sample: false,
    });

    trackClaudishSamplePick({ sample_index: 1, direction: 'en_to_claudish' });

    const allJson = JSON.stringify(window.dataLayer);
    expect(allJson).not.toContain('secret');
    expect(allJson).not.toContain(SOURCE);
    expect(allJson).not.toContain(TARGET);

    // Structural version of the same pin: every claudish-specific param is
    // a number, boolean, or short enum token (no free text of any kind).
    const BASE_KEYS = new Set([
      'event', 'iap_source', 'timestamp', 'session_id', 'iap_session_id',
      'anonymous_id', 'page_path', 'page_title',
      'consent_analytics', 'consent_marketing', 'consent_preferences',
    ]);
    for (const evt of window.dataLayer as Array<Record<string, unknown>>) {
      for (const [key, value] of Object.entries(evt)) {
        if (BASE_KEYS.has(key)) continue;
        const ok =
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          (typeof value === 'string' && /^[a-z0-9_-]{1,24}$/.test(value));
        expect(ok).toBe(true);
      }
    }
  });
});
