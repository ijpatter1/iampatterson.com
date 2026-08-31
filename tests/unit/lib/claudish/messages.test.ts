/**
 * Claudish translator — verbatim UI strings + limits (feat/claudish M1).
 *
 * The spec supplies several strings verbatim (refusal line, capacity line,
 * footer, thumb labels, language tag). They are product copy with exact
 * wording; these pins are character-for-character so a well-meaning voice
 * pass cannot drift them. limits.ts numbers are pinned because the char
 * counter, the server cap, and the share-URL budget must agree.
 */
import {
  CAPACITY_MESSAGE,
  CLAUDISH_LANG_TAG,
  DETECTED_LABEL,
  FOOTER_ATTRIBUTION,
  FOOTER_DISCLAIMER,
  RATE_DOWN_LABEL,
  RATE_UP_LABEL,
  REFUSAL_MESSAGE,
  TAB_LABELS,
} from '@/lib/claudish/messages';
import {
  CLIENT_CACHE_MAX_ENTRIES,
  DEBOUNCE_MS,
  INPUT_CAP,
  SHARE_URL_MAX,
} from '@/lib/claudish/limits';

describe('claudish verbatim strings', () => {
  it('pins the refusal line character-for-character', () => {
    expect(REFUSAL_MESSAGE).toBe(
      "This doesn't translate. It's not a dictionary gap; it's a line."
    );
  });

  it('pins the capacity line, which also serves generic errors by decision', () => {
    expect(CAPACITY_MESSAGE).toBe("This isn't an outage. It's a boundary.");
  });

  it('pins both footer lines', () => {
    expect(FOOTER_ATTRIBUTION).toBe(
      'A toy by Ian Patterson · marketing measurement and agentic AI · iampatterson.com'
    );
    expect(FOOTER_DISCLAIMER).toBe('Not affiliated with Google. Yet.');
  });

  it('pins the rate-modal thumb labels', () => {
    expect(RATE_UP_LABEL).toBe('Holds up.');
    expect(RATE_DOWN_LABEL).toBe("You're absolutely right.");
  });

  it('pins the BCP-47 private-use language tag', () => {
    expect(CLAUDISH_LANG_TAG).toBe('en-x-claudish');
  });

  it('pins the live-detection label', () => {
    expect(DETECTED_LABEL).toBe('Claudish - detected');
  });

  it('pins the two tab rows', () => {
    expect(TAB_LABELS.source).toEqual(['Detect language', 'English', 'Claudish']);
    expect(TAB_LABELS.target).toEqual(['English', 'Claudish']);
  });
});

describe('claudish limits', () => {
  it('caps input at 1,200 characters (user decision: counter shows the real cap)', () => {
    expect(INPUT_CAP).toBe(1200);
  });

  it('debounces translation at 600ms per the spec', () => {
    expect(DEBOUNCE_MS).toBe(600);
  });

  it('keeps share URLs under the classic 2,048 safe limit with headroom', () => {
    expect(SHARE_URL_MAX).toBe(1900);
    expect(SHARE_URL_MAX).toBeLessThan(2048);
  });

  it('bounds the client translation cache', () => {
    expect(CLIENT_CACHE_MAX_ENTRIES).toBe(50);
  });
});
