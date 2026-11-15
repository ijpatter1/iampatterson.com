/**
 * @jest-environment jsdom
 */

// A module, so its helpers do not collide with other test files' globals.
export {};

// 15.8: the events a returning visitor's page pushes before Cookiebot resolves
// their stored choice. Measured in production on 2026-11-14 (Chromium and
// WebKit), Cookiebot has no answer for ~180ms after a reload, and the landing
// page_view, scroll and web-vital events can all fire inside that window.
// Until 15.8 they carried the denied defaults and no visitor ID, so a
// consenting visitor's first events looked like a stranger's.

type Track = typeof import('@/lib/events/track');

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'minted-id' },
});

const GRANT_ALL =
  '{stamp:%27t%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:1}';
const DECLINE_ALL =
  '{stamp:%27t%27%2Cnecessary:true%2Cpreferences:false%2Cstatistics:false%2Cmarketing:false%2Cmethod:%27explicit%27%2Cver:1}';

/** A fresh track.ts, as on a page load: its consent state starts empty. */
function loadTrack(): Track {
  let mod!: Track;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/lib/events/track');
  });
  return mod;
}

const readAid = () =>
  document.cookie
    .split('; ')
    .find((c) => c.startsWith('_iap_aid='))
    ?.slice('_iap_aid='.length) ?? null;
type Pushed = {
  event: string;
  anonymous_id: string;
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
};
const events = () => window.dataLayer as Pushed[];
const gtagCalls: unknown[][] = [];

beforeEach(() => {
  window.dataLayer = [];
  gtagCalls.length = 0;
  (window as unknown as { gtag: (...a: unknown[]) => void }).gtag = (...a) => gtagCalls.push(a);
  document.cookie = '_iap_sid=test-session; Path=/';
});
afterEach(() => {
  for (const name of ['CookieConsent', '_iap_aid', '_iap_sid']) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
  delete (window as unknown as { gtag?: unknown }).gtag;
  delete (navigator as unknown as { globalPrivacyControl?: unknown }).globalPrivacyControl;
});

describe('events before Cookiebot resolves a stored choice', () => {
  it("carry a consenting visitor's stored consent and their existing visitor ID", () => {
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    document.cookie = '_iap_aid=returning-id; Path=/';
    const track = loadTrack();

    track.trackPageView('');

    expect(events()[0]).toEqual(
      expect.objectContaining({
        event: 'page_view',
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
        anonymous_id: 'returning-id',
      }),
    );
    expect(readAid()).toBe('returning-id');
  });

  it('give a consenting visitor without an ID cookie one, carried from the first event', () => {
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    const track = loadTrack();
    track.trackPageView('');
    expect(events()[0].anonymous_id).toBe('minted-id');
    expect(readAid()).toBe('minted-id');
  });

  // Nothing the visitor did this page load, so nothing in the data layer says
  // consent changed, and Google's tags already have the stored choice from the
  // inline script ahead of GTM: track.ts sends no second copy.
  it('push no consent_update and send no gtag update of their own', () => {
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    const track = loadTrack();
    track.trackPageView('');
    track.trackScrollDepth(25, 400);
    expect(events().map((e) => e.event)).toEqual(['page_view', 'scroll_depth']);
    expect(gtagCalls).toEqual([]);
  });

  it('carry marketing declined under Global Privacy Control, whatever was stored', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    const track = loadTrack();
    track.trackPageView('');
    expect(events()[0]).toEqual(
      expect.objectContaining({ consent_analytics: true, consent_marketing: false }),
    );
  });

  // The leftover rode the reload's consent_update until 15.8 removed it.
  it("expire a stored decliner's leftover visitor ID and carry none", () => {
    document.cookie = `CookieConsent=${DECLINE_ALL}; Path=/`;
    document.cookie = '_iap_aid=left-over; Path=/';
    const track = loadTrack();
    track.trackPageView('');
    expect(readAid()).toBeNull();
    expect(events()[0]).toEqual(
      expect.objectContaining({ consent_analytics: false, anonymous_id: '' }),
    );
  });

  it('expire the leftover from applyStoredConsent alone, before any event', () => {
    document.cookie = `CookieConsent=${DECLINE_ALL}; Path=/`;
    document.cookie = '_iap_aid=left-over; Path=/';
    const track = loadTrack();
    track.applyStoredConsent();
    expect(readAid()).toBeNull();
  });

  // getCurrentConsent is a pure read: the listener's mount and the first
  // event apply the stored choice, not a reader of the snapshot.
  it('leave getCurrentConsent a pure read that reports the stored consent once applied', () => {
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    const track = loadTrack();
    expect(track.getCurrentConsent()).toEqual({
      consent_analytics: false,
      consent_marketing: false,
      consent_preferences: false,
    });
    expect(readAid()).toBeNull();
    track.applyStoredConsent();
    expect(track.getCurrentConsent()).toEqual({
      consent_analytics: true,
      consent_marketing: true,
      consent_preferences: true,
    });
  });

  // Cookiebot's own answer (hasResponse false, or its resolved choice) owns
  // this visitor's leftover; see the listener's tests.
  it('leave a visitor with no stored choice on the defaults, without touching the cookie', () => {
    document.cookie = '_iap_aid=left-over; Path=/';
    const track = loadTrack();
    track.trackPageView('');
    expect(events()[0]).toEqual(
      expect.objectContaining({ consent_analytics: false, anonymous_id: '' }),
    );
    expect(readAid()).toBe('left-over');
  });

  it("give way to Cookiebot's answer once it has one", () => {
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    const track = loadTrack();
    track.initConsentState(false, false, false, true);
    track.trackPageView('');
    expect(events()[0].consent_analytics).toBe(false);
  });

  // A choice made in another tab reaches this tab's tags only on its next
  // load, so this tab's events must not claim it either.
  it('read the cookie once per page load', () => {
    const track = loadTrack();
    track.trackPageView('');
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    track.trackPageView('');
    expect(events()[1].consent_analytics).toBe(false);
  });
});

// The stub the consent-defaults script defines: every gtag call lands in the
// data layer, which is how GTM, and the bridge's check below, see it.
function realGtag() {
  (window as unknown as { gtag: (...a: unknown[]) => void }).gtag = function (...a: unknown[]) {
    gtagCalls.push(a);
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments as unknown as Record<string, unknown>);
  };
}
const gtagConsentUpdates = () => gtagCalls.filter((c) => c[0] === 'consent' && c[1] === 'update');

describe('a silent record sends Consent Mode only what is not already in force', () => {
  const ALL_GRANTED = {
    analytics_storage: 'granted',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    functionality_storage: 'granted',
    personalization_storage: 'granted',
  };

  // Cookiebot's replay of the stored choice the inline script already sent.
  it('skips the bridge when the same consent is already in force', () => {
    realGtag();
    (window as unknown as { gtag: (...a: unknown[]) => void }).gtag(
      'consent',
      'update',
      ALL_GRANTED,
    );
    gtagCalls.length = 0;
    const track = loadTrack();
    track.initConsentState(true, true, true, true);
    expect(gtagCalls).toEqual([]);
  });

  it('bridges when what is in force differs', () => {
    realGtag();
    (window as unknown as { gtag: (...a: unknown[]) => void }).gtag(
      'consent',
      'update',
      ALL_GRANTED,
    );
    gtagCalls.length = 0;
    const track = loadTrack();
    track.initConsentState(false, false, false, true);
    expect(gtagConsentUpdates()).toEqual([
      ['consent', 'update', expect.objectContaining({ analytics_storage: 'denied' })],
    ]);
  });

  // The in-force check uses its own copy of the bridge's mapping; this pins
  // the two together. After the bridge sends a state, recording the same
  // state sends nothing, and recording any other state sends an update.
  const states: [boolean, boolean, boolean][] = [];
  for (const a of [true, false])
    for (const m of [true, false]) for (const p of [true, false]) states.push([a, m, p]);
  it.each(states)(
    'agrees with the bridge for analytics=%s marketing=%s preferences=%s',
    (a, m, p) => {
      realGtag();
      const track = loadTrack();
      track.trackConsentUpdate(a, m, p);
      gtagCalls.length = 0;
      track.initConsentState(a, m, p, true);
      expect(gtagCalls).toEqual([]);
      track.initConsentState(!a, m, p, true);
      expect(gtagConsentUpdates()).toHaveLength(1);
    },
  );

  // A choice is always sent, whatever is in force.
  it('always bridges a choice the visitor makes', () => {
    realGtag();
    (window as unknown as { gtag: (...a: unknown[]) => void }).gtag(
      'consent',
      'update',
      ALL_GRANTED,
    );
    gtagCalls.length = 0;
    const track = loadTrack();
    track.trackConsentUpdate(true, true, true);
    expect(gtagConsentUpdates()).toHaveLength(1);
  });
});

// 15.8: a first-time visitor's landing page_view is pushed while consent is
// denied, and GTM blocks its tag. When the visitor then grants analytics in
// the banner, the page is sent again, once per page load. Measured before
// this on localhost (2026-11-15): the only hit after Allow all was
// consent_update.
describe('the page_view a grant in the banner sends again', () => {
  const pageViews = () =>
    events().filter((e) => e.event === 'page_view') as (Pushed & {
      page_referrer: string;
      page_path: string;
    })[];

  it('re-pushes the page, with its referrer, after consent_update and with the new ID', () => {
    const track = loadTrack();
    track.trackPageView('https://www.linkedin.com/');
    track.trackConsentUpdate(true, false, false, true);
    expect(events().map((e) => e.event)).toEqual(['page_view', 'consent_update', 'page_view']);
    expect(pageViews()[1]).toEqual(
      expect.objectContaining({
        consent_analytics: true,
        anonymous_id: 'minted-id',
        page_referrer: 'https://www.linkedin.com/',
        page_path: window.location.pathname,
      }),
    );
  });

  it('re-pushes it once per page load', () => {
    const track = loadTrack();
    track.trackPageView('');
    track.trackConsentUpdate(true, false, false, true);
    track.trackConsentUpdate(false, false, false, true);
    track.trackConsentUpdate(true, false, false, true);
    expect(pageViews()).toHaveLength(2);
  });

  it('does not re-push for a choice that is not a banner submission', () => {
    const track = loadTrack();
    track.trackPageView('');
    track.trackConsentUpdate(true, false, false);
    expect(pageViews()).toHaveLength(1);
  });

  it('does not re-push when the submission leaves analytics denied', () => {
    const track = loadTrack();
    track.trackPageView('');
    track.trackConsentUpdate(false, true, true, true);
    expect(pageViews()).toHaveLength(1);
  });

  it('does not re-push a page_view that was already sent with analytics granted', () => {
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    const track = loadTrack();
    track.trackPageView('');
    track.trackConsentUpdate(false, false, false, true);
    track.trackConsentUpdate(true, true, true, true);
    expect(pageViews()).toHaveLength(1);
  });

  it('re-pushes the current page with the previous path after a client-side navigation', () => {
    const track = loadTrack();
    const start = window.location.pathname;
    track.trackPageView('');
    window.history.pushState({}, '', '/review');
    try {
      track.trackPageView(start);
      track.trackConsentUpdate(true, false, false, true);
      expect(pageViews()[2]).toEqual(
        expect.objectContaining({ page_path: '/review', page_referrer: start }),
      );
    } finally {
      window.history.pushState({}, '', start);
    }
  });
});
