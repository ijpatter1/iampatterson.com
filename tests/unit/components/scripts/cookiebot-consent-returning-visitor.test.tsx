/**
 * @jest-environment jsdom
 */

// A module, so its helpers do not collide with other test files' globals.
export {};

// The consent listener's returning-visitor path (15.8), against the real
// track.ts, in the sequence Cookiebot really produces. Measured in production
// on 2026-11-14 (Chromium and WebKit) and on localhost on 2026-11-15:
//
//   ~15ms   window.Cookiebot exists with no answer (hasResponse undefined)
//   ~180ms  CookiebotOnConsentReady, CookiebotOnLoad, then CookiebotOnAccept or
//           CookiebotOnDecline, with hasResponse true and changed false
//
// A choice the visitor makes in the banner fires the same events with
// changed true. Each test loads fresh modules, as a page load does.

type Track = typeof import('@/lib/events/track');
type Listener = typeof import('@/components/scripts/cookiebot-consent');
type RTL = typeof import('@testing-library/react');

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'minted-id' },
});

const storedChoice = (statistics: boolean, marketing: boolean, preferences: boolean) =>
  `{stamp:%27t%27%2Cnecessary:true%2Cpreferences:${preferences}%2Cstatistics:${statistics}%2Cmarketing:${marketing}%2Cmethod:%27explicit%27%2Cver:1}`;

type CookiebotStub = {
  hasResponse?: boolean;
  changed?: boolean;
  consent?: { statistics?: boolean; marketing?: boolean; preferences?: boolean };
};
const setCookiebot = (cb: CookiebotStub) => {
  (window as unknown as { Cookiebot: CookiebotStub }).Cookiebot = cb;
};

let track: Track;
let rtl: RTL;
let gtagCalls: unknown[][];

/** A page load: fresh modules, Cookiebot present without an answer, listener mounted. */
function loadPage() {
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  rtl = require('@testing-library/react/pure');
  const React = require('react');
  track = require('@/lib/events/track');
  const { CookiebotConsentListener } =
    require('@/components/scripts/cookiebot-consent') as Listener;
  /* eslint-enable @typescript-eslint/no-require-imports */
  setCookiebot({ consent: {} });
  rtl.render(React.createElement(CookiebotConsentListener));
}

/** ~180ms later: Cookiebot replays the stored choice. */
function cookiebotResolves(
  consent: { statistics: boolean; marketing: boolean; preferences: boolean },
  changed = false,
) {
  setCookiebot({ hasResponse: true, changed, consent });
  rtl.act(() => {
    window.dispatchEvent(new Event('CookiebotOnConsentReady'));
    window.dispatchEvent(new Event('CookiebotOnLoad'));
    window.dispatchEvent(
      new Event(consent.statistics ? 'CookiebotOnAccept' : 'CookiebotOnDecline'),
    );
  });
}

const readAid = () =>
  document.cookie
    .split('; ')
    .find((c) => c.startsWith('_iap_aid='))
    ?.slice('_iap_aid='.length) ?? null;
type Pushed = {
  event?: string;
  anonymous_id?: string;
  consent_analytics?: boolean;
  consent_marketing?: boolean;
};
const pushed = () => (window.dataLayer as Pushed[]).filter((e) => typeof e.event === 'string');
const consentUpdates = () => pushed().filter((e) => e.event === 'consent_update');
const deniedGtagUpdates = () =>
  gtagCalls.filter(
    (c) =>
      c[0] === 'consent' &&
      c[1] === 'update' &&
      (c[2] as Record<string, string>).analytics_storage === 'denied',
  );

beforeEach(() => {
  window.dataLayer = [];
  gtagCalls = [];
  (window as unknown as { gtag: (...a: unknown[]) => void }).gtag = (...a) => gtagCalls.push(a);
  document.cookie = '_iap_sid=test-session; Path=/';
});
afterEach(() => {
  rtl?.cleanup();
  for (const name of ['CookieConsent', '_iap_aid', '_iap_sid']) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
  delete (window as unknown as { gtag?: unknown }).gtag;
  delete (window as unknown as { Cookiebot?: unknown }).Cookiebot;
});

describe('a returning visitor who granted analytics', () => {
  beforeEach(() => {
    document.cookie = `CookieConsent=${storedChoice(true, true, true)}; Path=/`;
    document.cookie = '_iap_aid=returning-id; Path=/';
  });

  it('sends Google no denied update while Cookiebot is unresolved', () => {
    loadPage();
    expect(deniedGtagUpdates()).toEqual([]);
  });

  it('carries the stored consent and visitor ID on events before Cookiebot resolves', () => {
    loadPage();
    rtl.act(() => track.trackPageView(''));
    expect(pushed()[0]).toEqual(
      expect.objectContaining({
        event: 'page_view',
        consent_analytics: true,
        consent_marketing: true,
        anonymous_id: 'returning-id',
      }),
    );
  });

  it('pushes no consent_update when Cookiebot replays the stored choice', () => {
    loadPage();
    cookiebotResolves({ statistics: true, marketing: true, preferences: true });
    expect(consentUpdates()).toEqual([]);
    expect(deniedGtagUpdates()).toEqual([]);
    rtl.act(() => track.trackPageView(''));
    expect(pushed().at(-1)).toEqual(
      expect.objectContaining({ consent_analytics: true, anonymous_id: 'returning-id' }),
    );
    expect(readAid()).toBe('returning-id');
  });

  it('pushes a consent_update when the visitor then withdraws in the banner', () => {
    loadPage();
    cookiebotResolves({ statistics: true, marketing: true, preferences: true });
    cookiebotResolves({ statistics: false, marketing: false, preferences: false }, true);
    expect(consentUpdates()).toEqual([
      expect.objectContaining({ consent_analytics: false, anonymous_id: '' }),
    ]);
    expect(readAid()).toBeNull();
  });
});

describe('a returning visitor who declined', () => {
  beforeEach(() => {
    document.cookie = `CookieConsent=${storedChoice(false, false, false)}; Path=/`;
  });

  // Production minted `_iap_aid` for every visitor until 2026-11-14. Until
  // 15.8 the reload's consent_update is what expired a decliner's leftover.
  it('has a leftover visitor ID expired on mount, before Cookiebot resolves', () => {
    document.cookie = '_iap_aid=left-over; Path=/';
    loadPage();
    expect(readAid()).toBeNull();
  });

  it('pushes no consent_update when Cookiebot replays the decline, and carries no ID', () => {
    document.cookie = '_iap_aid=left-over; Path=/';
    loadPage();
    cookiebotResolves({ statistics: false, marketing: false, preferences: false });
    expect(consentUpdates()).toEqual([]);
    rtl.act(() => track.trackPageView(''));
    expect(pushed().at(-1)).toEqual(
      expect.objectContaining({ consent_analytics: false, anonymous_id: '' }),
    );
    expect(readAid()).toBeNull();
  });

  it('pushes a consent_update when the visitor then grants in the banner', () => {
    loadPage();
    cookiebotResolves({ statistics: false, marketing: false, preferences: false });
    cookiebotResolves({ statistics: true, marketing: false, preferences: false }, true);
    expect(consentUpdates()).toEqual([expect.objectContaining({ consent_analytics: true })]);
    expect(readAid()).toBe('minted-id');
  });
});

// The page as it really runs: the gtag stub writes to the data layer, the
// defaults are in it, and the inline script has sent the stored choice.
function pageScriptsRan() {
  const gtag = function (...a: unknown[]) {
    gtagCalls.push(a);
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments as unknown as Record<string, unknown>);
  };
  (window as unknown as { gtag: typeof gtag }).gtag = gtag;
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { STORED_CONSENT_UPDATE_JS } = require('@/lib/events/stored-consent');
  new Function('gtag', STORED_CONSENT_UPDATE_JS)(gtag);
  gtagCalls.length = 0;
}

describe("Cookiebot's replay of a stored choice already in force", () => {
  it('sends Consent Mode nothing more', () => {
    document.cookie = `CookieConsent=${storedChoice(true, true, true)}; Path=/`;
    pageScriptsRan();
    loadPage();
    cookiebotResolves({ statistics: true, marketing: true, preferences: true });
    expect(gtagCalls).toEqual([]);
  });
});

// Cookiebot is authoritative once it reports, even with no answer: a stored
// grant it rejects (an invalid cookie, or consent it asks to renew) is
// withdrawn.
describe('a stored grant Cookiebot reports no answer for', () => {
  it('is withdrawn: denied to Consent Mode, denied on events, ID expired', () => {
    document.cookie = `CookieConsent=${storedChoice(true, true, true)}; Path=/`;
    document.cookie = '_iap_aid=returning-id; Path=/';
    pageScriptsRan();
    loadPage();
    setCookiebot({
      hasResponse: false,
      consent: { statistics: false, marketing: false, preferences: false },
    });
    rtl.act(() => {
      window.dispatchEvent(new Event('CookiebotOnDialogInit'));
    });
    expect(deniedGtagUpdates()).toHaveLength(1);
    expect(readAid()).toBeNull();
    rtl.act(() => track.trackPageView(''));
    expect(pushed().at(-1)).toEqual(
      expect.objectContaining({ consent_analytics: false, anonymous_id: '' }),
    );
    expect(consentUpdates()).toEqual([]);
  });
});

// 15.8 acceptance: a page_view hit on every landing page once analytics is
// granted, including the page where a first-time visitor grants. Measured
// never-chosen sequence: hasResponse undefined at mount, false by
// CookiebotOnDialogInit, then the submission with changed true.
describe('a first-time visitor who allows analytics on the landing page', () => {
  function firstVisit() {
    pageScriptsRan();
    loadPage();
    rtl.act(() => track.trackPageView('https://www.linkedin.com/'));
    setCookiebot({
      hasResponse: false,
      consent: { statistics: false, marketing: false, preferences: false },
    });
    rtl.act(() => {
      window.dispatchEvent(new Event('CookiebotOnDialogInit'));
      window.dispatchEvent(new Event('CookiebotOnDialogDisplay'));
    });
  }
  type PageView = Pushed & { page_referrer?: string; page_path?: string };

  it('gets the landing page_view again, after consent_update, with its referrer and the new ID', () => {
    firstVisit();
    cookiebotResolves({ statistics: true, marketing: true, preferences: true }, true);
    const events = pushed() as PageView[];
    expect(events.map((e) => e.event)).toEqual(['page_view', 'consent_update', 'page_view']);
    expect(events[0]).toEqual(expect.objectContaining({ consent_analytics: false }));
    expect(events[2]).toEqual(
      expect.objectContaining({
        consent_analytics: true,
        anonymous_id: 'minted-id',
        page_referrer: 'https://www.linkedin.com/',
      }),
    );
  });

  it('gets no second page_view when the visitor declines', () => {
    firstVisit();
    cookiebotResolves({ statistics: false, marketing: false, preferences: false }, true);
    expect(pushed().map((e) => e.event)).toEqual(['page_view', 'consent_update']);
  });

  it('gets no second page_view for a returning visitor whose stored grant was replayed', () => {
    document.cookie = `CookieConsent=${storedChoice(true, true, true)}; Path=/`;
    pageScriptsRan();
    loadPage();
    rtl.act(() => track.trackPageView(''));
    cookiebotResolves({ statistics: true, marketing: true, preferences: true });
    expect(pushed().map((e) => e.event)).toEqual(['page_view']);
  });
});
