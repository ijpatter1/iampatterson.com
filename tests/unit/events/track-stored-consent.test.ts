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

  it('report the stored consent to readers of the snapshot before any event', () => {
    document.cookie = `CookieConsent=${GRANT_ALL}; Path=/`;
    const track = loadTrack();
    expect(track.getCurrentConsent()).toEqual({
      consent_analytics: true,
      consent_marketing: true,
      consent_preferences: true,
    });
  });

  // The never-chosen cleanup (expireAnonymousIdLeftover) owns this visitor.
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
