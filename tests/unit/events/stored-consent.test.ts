/**
 * @jest-environment jsdom
 */
import { STORED_CONSENT_UPDATE_JS, readStoredConsent } from '@/lib/events/stored-consent';

// Cookiebot keeps the visitor's choice in its `CookieConsent` cookie. This is
// the value it wrote on localhost on 2026-11-15 after "Allow all" (the stamp
// is replaced; the shape is Cookiebot's): unquoted keys, quotes as %27 and
// commas as %2C.
const cookieValue = (flags: { preferences: boolean; statistics: boolean; marketing: boolean }) =>
  `{stamp:%27test-stamp==%27%2Cnecessary:true%2Cpreferences:${flags.preferences}%2Cstatistics:${flags.statistics}%2Cmarketing:${flags.marketing}%2Cmethod:%27explicit%27%2Cver:1%2Cutc:1794775847946%2Cregion:%27us-13%27}`;

// The shape the Phase 14 e2e spec plants: literal commas.
const E2E_DENIED =
  '{stamp:%27uat%27,necessary:true,preferences:false,statistics:false,marketing:false,method:%27explicit%27,ver:1}';

describe('readStoredConsent', () => {
  it("reads the three categories from Cookiebot's cookie as it really writes it", () => {
    const header = `_iap_sid=abc; CookieConsent=${cookieValue({ preferences: true, statistics: true, marketing: false })}; other=1`;
    expect(readStoredConsent(header)).toEqual({
      analytics: true,
      marketing: false,
      preferences: true,
    });
  });

  it('reads a stored decline', () => {
    const header = `CookieConsent=${cookieValue({ preferences: false, statistics: false, marketing: false })}`;
    expect(readStoredConsent(header)).toEqual({
      analytics: false,
      marketing: false,
      preferences: false,
    });
  });

  it('reads the literal-comma shape the e2e spec plants', () => {
    expect(readStoredConsent(`CookieConsent=${E2E_DENIED}`)).toEqual({
      analytics: false,
      marketing: false,
      preferences: false,
    });
  });

  // No stored choice means the denied defaults stand and Cookiebot decides.
  // Guessing here would grant consent nobody gave.
  it.each([
    ['no cookie at all', '_iap_sid=abc'],
    ['an empty header', ''],
    ['the value Cookiebot uses where it needs no consent', 'CookieConsent=-1'],
    ['a value without the three categories', 'CookieConsent=granted_all'],
    ['a category missing', 'CookieConsent={statistics:true%2Cmarketing:true}'],
    [
      'another cookie whose name ends the same way',
      `XCookieConsent=${cookieValue({ preferences: true, statistics: true, marketing: true })}`,
    ],
  ])('returns null for %s', (_label, header) => {
    expect(readStoredConsent(header)).toBeNull();
  });

  // decodeURIComponent throws on a broken escape. That must not fail the page;
  // the flags are read from the raw text instead.
  it('reads the flags from the raw text when the value is not valid percent-encoding', () => {
    expect(
      readStoredConsent(
        'CookieConsent={stamp:%E0%A4%A,statistics:true,marketing:true,preferences:true}',
      ),
    ).toEqual({ analytics: true, marketing: true, preferences: true });
  });
});

describe('STORED_CONSENT_UPDATE_JS, the inline update ahead of GTM', () => {
  type Gtag = (...args: unknown[]) => void;
  let calls: unknown[][];

  function run(cookieHeader: string, gpc: boolean): unknown[][] {
    calls = [];
    const gtag: Gtag = (...args) => calls.push(args);
    const doc = { cookie: cookieHeader };
    const nav = gpc ? { globalPrivacyControl: true } : {};
    // The script reads only `document`, `navigator` and `gtag`.
    new Function('document', 'navigator', 'gtag', STORED_CONSENT_UPDATE_JS)(doc, nav, gtag);
    return calls;
  }

  it('sends the stored choice to Consent Mode, redaction first', () => {
    run(
      `CookieConsent=${cookieValue({ preferences: true, statistics: true, marketing: true })}`,
      false,
    );
    expect(calls).toEqual([
      ['set', 'ads_data_redaction', false],
      [
        'consent',
        'update',
        {
          analytics_storage: 'granted',
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          functionality_storage: 'granted',
          personalization_storage: 'granted',
        },
      ],
    ]);
  });

  it('holds the advertising signals denied under Global Privacy Control, whatever was stored', () => {
    run(
      `CookieConsent=${cookieValue({ preferences: false, statistics: true, marketing: true })}`,
      true,
    );
    expect(calls).toEqual([
      ['set', 'ads_data_redaction', true],
      [
        'consent',
        'update',
        {
          analytics_storage: 'granted',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          functionality_storage: 'denied',
          personalization_storage: 'denied',
        },
      ],
    ]);
  });

  it('sends nothing for a visitor with no stored choice, so the denied defaults stand', () => {
    expect(run('_iap_sid=abc', false)).toEqual([]);
    expect(run('CookieConsent=-1', false)).toEqual([]);
  });

  it('never throws into the page, whatever the cookie holds', () => {
    expect(() => run('CookieConsent=%', false)).not.toThrow();
  });

  // The inline script and readStoredConsent read the same cookie for the same
  // page load: one feeds Google's tags, the other every event this site
  // pushes. They must agree, or the events would say one thing and the tags
  // another.
  it.each([
    [true, true, true],
    [true, false, true],
    [false, true, false],
    [false, false, false],
    [true, true, false],
  ])(
    'agrees with readStoredConsent for statistics=%s marketing=%s preferences=%s',
    (statistics, marketing, preferences) => {
      const header = `CookieConsent=${cookieValue({ statistics, marketing, preferences })}`;
      const stored = readStoredConsent(header)!;
      const update = run(header, false).find((c) => c[0] === 'consent')![2] as Record<
        string,
        string
      >;
      expect(update.analytics_storage === 'granted').toBe(stored.analytics);
      expect(update.ad_storage === 'granted').toBe(stored.marketing);
      expect(update.functionality_storage === 'granted').toBe(stored.preferences);
    },
  );
});
