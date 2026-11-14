/**
 * @jest-environment jsdom
 */
import {
  trackPageView,
  trackClickNav,
  trackClickCta,
  trackFormFieldFocus,
  trackFormStart,
  trackFormSubmit,
  trackConsentUpdate,
  trackWebVital,
  trackPageEngagement,
  initConsentState,
} from '@/lib/events/track';

// Mock crypto.randomUUID for session ID
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-session-id' },
});

beforeEach(() => {
  window.dataLayer = [];
  // Clear session + anonymous cookies between tests so each one starts from
  // a deterministic empty-cookie state.
  document.cookie = '_iap_sid=; Max-Age=0; Path=/';
  document.cookie = '_iap_aid=; Max-Age=0; Path=/';
});

describe('trackPageView', () => {
  it('pushes a page_view event with referrer', () => {
    trackPageView('/about');
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'page_view',
      page_referrer: '/about',
      session_id: 'test-session-id',
    });
  });
});

describe('trackClickNav', () => {
  it('pushes a click_nav event with link text and URL', () => {
    trackClickNav('Services', '/services');
    expect(window.dataLayer[0]).toMatchObject({
      event: 'click_nav',
      link_text: 'Services',
      link_url: '/services',
    });
  });
});

describe('trackClickCta', () => {
  it('pushes a click_cta event with CTA text and location', () => {
    trackClickCta('See how it works', 'hero');
    expect(window.dataLayer[0]).toMatchObject({
      event: 'click_cta',
      cta_text: 'See how it works',
      cta_location: 'hero',
    });
  });
});

describe('trackFormFieldFocus', () => {
  it('pushes a form_field_focus event', () => {
    trackFormFieldFocus('contact', 'email');
    expect(window.dataLayer[0]).toMatchObject({
      event: 'form_field_focus',
      form_name: 'contact',
      field_name: 'email',
    });
  });
});

describe('trackFormStart', () => {
  it('pushes a form_start event', () => {
    trackFormStart('contact');
    expect(window.dataLayer[0]).toMatchObject({
      event: 'form_start',
      form_name: 'contact',
    });
  });
});

describe('trackFormSubmit', () => {
  it('pushes a form_submit event with success flag', () => {
    trackFormSubmit('contact', true);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'form_submit',
      form_name: 'contact',
      form_success: true,
    });
  });
});

describe('trackConsentUpdate', () => {
  it('pushes a consent_update event with consent state', () => {
    trackConsentUpdate(true, false, true);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'consent_update',
      consent_analytics: true,
      consent_marketing: false,
      consent_preferences: true,
    });
  });

  it('pushes a consent_update with all denied', () => {
    trackConsentUpdate(false, false, false);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'consent_update',
      consent_analytics: false,
      consent_marketing: false,
      consent_preferences: false,
    });
  });

  // Phase 1 D3 architectural amendment (2026-04-25): Cookiebot loaded with
  // `data-blockingmode="manual"` instead of `"auto"`, so consent gating
  // delegates entirely to GTM Consent Mode v2. trackConsentUpdate must
  // explicitly bridge to gtag('consent', 'update', {...}) — what auto-mode
  // used to do implicitly. These pins verify the bridge is wired correctly
  // for each Cookiebot category and for the all-granted / all-denied edges.

  // GTM evaluates the tags triggered by an event against the consent state
  // in force when it reaches that data layer entry. The consent update must
  // therefore be queued before the consent_update event, or the tags on that
  // event (GA4 - consent_update among them) are judged against the visitor's
  // previous choice: blocked after an acceptance, sent after a withdrawal.
  it('queues the consent update ahead of the consent_update event', () => {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = function (...args) {
      window.dataLayer.push(args as unknown as Record<string, unknown>);
    };
    trackConsentUpdate(true, true, true);
    const entries = window.dataLayer as unknown as Array<Record<string | number, unknown>>;
    const updateAt = entries.findIndex((e) => e[0] === 'consent' && e[1] === 'update');
    const eventAt = entries.findIndex((e) => e.event === 'consent_update');
    expect(updateAt).toBeGreaterThanOrEqual(0);
    expect(eventAt).toBeGreaterThan(updateAt);
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it('bridges to gtag consent update with all-granted Cookiebot signals', () => {
    const gtagCalls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      gtagCalls.push(args);
    };
    trackConsentUpdate(true, true, true);
    const consentCalls = gtagCalls.filter((c) => c[0] === 'consent' && c[1] === 'update');
    expect(consentCalls).toHaveLength(1);
    expect(consentCalls[0][2]).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functionality_storage: 'granted',
      personalization_storage: 'granted',
    });
  });

  it('bridges to gtag consent update with all-denied Cookiebot signals', () => {
    const gtagCalls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      gtagCalls.push(args);
    };
    trackConsentUpdate(false, false, false);
    const consentCalls = gtagCalls.filter((c) => c[0] === 'consent' && c[1] === 'update');
    expect(consentCalls).toHaveLength(1);
    expect(consentCalls[0][2]).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'denied',
      personalization_storage: 'denied',
    });
  });

  it('maps Cookiebot statistics → analytics_storage independently of marketing/preferences', () => {
    const gtagCalls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      gtagCalls.push(args);
    };
    trackConsentUpdate(true, false, false);
    const payload = gtagCalls.filter((c) => c[1] === 'update')[0][2] as Record<string, string>;
    expect(payload.analytics_storage).toBe('granted');
    expect(payload.ad_storage).toBe('denied');
    expect(payload.ad_user_data).toBe('denied');
    expect(payload.ad_personalization).toBe('denied');
    expect(payload.functionality_storage).toBe('denied');
    expect(payload.personalization_storage).toBe('denied');
  });

  it('maps Cookiebot marketing → ad_storage + ad_user_data + ad_personalization (the three ad signals)', () => {
    const gtagCalls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      gtagCalls.push(args);
    };
    trackConsentUpdate(false, true, false);
    const payload = gtagCalls.filter((c) => c[1] === 'update')[0][2] as Record<string, string>;
    expect(payload.analytics_storage).toBe('denied');
    expect(payload.ad_storage).toBe('granted');
    expect(payload.ad_user_data).toBe('granted');
    expect(payload.ad_personalization).toBe('granted');
    expect(payload.functionality_storage).toBe('denied');
    expect(payload.personalization_storage).toBe('denied');
  });

  it('maps Cookiebot preferences → functionality_storage + personalization_storage', () => {
    const gtagCalls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      gtagCalls.push(args);
    };
    trackConsentUpdate(false, false, true);
    const payload = gtagCalls.filter((c) => c[1] === 'update')[0][2] as Record<string, string>;
    expect(payload.functionality_storage).toBe('granted');
    expect(payload.personalization_storage).toBe('granted');
    expect(payload.analytics_storage).toBe('denied');
    expect(payload.ad_storage).toBe('denied');
  });

  it('does not include security_storage in the gtag bridge payload (always granted via consent-defaults inline script)', () => {
    const gtagCalls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      gtagCalls.push(args);
    };
    trackConsentUpdate(true, true, true);
    const payload = gtagCalls.filter((c) => c[1] === 'update')[0][2] as Record<string, string>;
    expect(payload).not.toHaveProperty('security_storage');
  });

  it('survives missing window.gtag (e.g. SSR or pre-GTM-init) without throwing', () => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    expect(() => trackConsentUpdate(true, false, true)).not.toThrow();
    // The data-layer push still happened.
    expect(window.dataLayer[0]).toMatchObject({ event: 'consent_update' });
  });
});

describe('initConsentState', () => {
  // initConsentState is called by CookiebotConsentListener for returning
  // visitors who already have Cookiebot consent set when the page loads.
  // Same gtag bridge requirement as trackConsentUpdate — without this,
  // returning visitors would stay on the denied defaults forever.

  it('bridges to gtag consent update with the returning-visitor consent snapshot', () => {
    const gtagCalls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      gtagCalls.push(args);
    };
    initConsentState(true, false, true);
    const consentCalls = gtagCalls.filter((c) => c[0] === 'consent' && c[1] === 'update');
    expect(consentCalls).toHaveLength(1);
    expect(consentCalls[0][2]).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      functionality_storage: 'granted',
    });
  });

  it('does NOT push a consent_update event to the data layer (init is silent vs trackConsentUpdate)', () => {
    initConsentState(true, true, true);
    const consentEvents = window.dataLayer.filter((e) => e.event === 'consent_update');
    expect(consentEvents).toHaveLength(0);
  });
});

// Phase 15, deliverable 15.5: Global Privacy Control is honored on this
// site. The signal is a standing opt-out of sale, sharing and
// targeted advertising, so it wins over the banner for the three advertising
// signals: "Accept all" must not grant them. Analytics and preferences are not
// what the signal speaks to, so they keep following the visitor's banner choice.
describe('Global Privacy Control', () => {
  function captureGtag(): unknown[][] {
    const calls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      calls.push(args);
    };
    return calls;
  }
  const consentUpdates = (calls: unknown[][]) =>
    calls.filter((c) => c[0] === 'consent' && c[1] === 'update').map((c) => c[2]);

  beforeEach(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
  });
  afterEach(() => {
    delete (navigator as unknown as { globalPrivacyControl?: unknown }).globalPrivacyControl;
    initConsentState(false, false, false);
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it('keeps the three advertising signals denied when the visitor accepts everything in the banner', () => {
    const calls = captureGtag();
    trackConsentUpdate(true, true, true);
    expect(consentUpdates(calls)).toEqual([
      expect.objectContaining({
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      }),
    ]);
  });

  it('still grants analytics and preferences when the visitor accepts them', () => {
    const calls = captureGtag();
    trackConsentUpdate(true, true, true);
    expect(consentUpdates(calls)[0]).toMatchObject({
      analytics_storage: 'granted',
      functionality_storage: 'granted',
      personalization_storage: 'granted',
    });
  });

  it('records marketing consent as declined on the consent_update event itself', () => {
    trackConsentUpdate(true, true, true);
    expect(window.dataLayer[0]).toMatchObject({
      event: 'consent_update',
      consent_analytics: true,
      consent_marketing: false,
      consent_preferences: true,
    });
  });

  it('carries the declined marketing consent on every later event', () => {
    trackConsentUpdate(true, true, true);
    trackPageView('');
    expect(window.dataLayer[1]).toMatchObject({
      event: 'page_view',
      consent_analytics: true,
      consent_marketing: false,
    });
  });

  it('holds the advertising signals denied for a returning visitor whose stored choice accepted marketing', () => {
    const calls = captureGtag();
    initConsentState(true, true, true);
    expect(consentUpdates(calls)[0]).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    trackPageView('');
    expect(window.dataLayer[0]).toMatchObject({ consent_marketing: false });
  });

  it('keeps ads data redaction on when the signal overrides an accepted banner', () => {
    const calls = captureGtag();
    trackConsentUpdate(true, true, true);
    expect(calls).toContainEqual(['set', 'ads_data_redaction', true]);
    expect(calls).not.toContainEqual(['set', 'ads_data_redaction', false]);
  });

  it('grants the advertising signals as before when the browser sends no signal', () => {
    delete (navigator as unknown as { globalPrivacyControl?: unknown }).globalPrivacyControl;
    const calls = captureGtag();
    trackConsentUpdate(true, true, true);
    expect(consentUpdates(calls)[0]).toMatchObject({
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    expect(window.dataLayer[0]).toMatchObject({ consent_marketing: true });
  });
});

// The site bridge is the only writer of Consent Mode (Cookiebot's own writes
// are switched off on its script tag), so it also owns ads data redaction,
// which Cookiebot used to set from the marketing choice.
describe('ads data redaction follows marketing consent', () => {
  function captureGtag(): unknown[][] {
    const calls: unknown[][] = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
      calls.push(args);
    };
    return calls;
  }
  afterEach(() => {
    initConsentState(false, false, false);
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it('turns redaction off when marketing is granted', () => {
    const calls = captureGtag();
    trackConsentUpdate(true, true, true);
    expect(calls).toContainEqual(['set', 'ads_data_redaction', false]);
  });

  it('keeps redaction on when marketing is declined', () => {
    const calls = captureGtag();
    trackConsentUpdate(true, false, true);
    expect(calls).toContainEqual(['set', 'ads_data_redaction', true]);
  });

  // A withdrawal must never be processed with redaction still off: that is
  // the one combination, advertising storage denied and redaction false, in
  // which redaction matters.
  it('sets redaction before the consent update it belongs to', () => {
    const calls = captureGtag();
    trackConsentUpdate(true, false, true);
    const redaction = calls.findIndex((c) => c[0] === 'set' && c[1] === 'ads_data_redaction');
    const update = calls.findIndex((c) => c[0] === 'consent' && c[1] === 'update');
    expect(redaction).toBeGreaterThan(-1);
    expect(redaction).toBeLessThan(update);
  });

  it('applies the same rule to a returning visitor', () => {
    const calls = captureGtag();
    initConsentState(true, true, true);
    expect(calls).toContainEqual(['set', 'ads_data_redaction', false]);
  });
});

describe('trackWebVital', () => {
  it('pushes a web_vital event with metric fields for each of the five CWV metrics', () => {
    const metrics: Array<{
      metric_name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
      metric_value: number;
    }> = [
      { metric_name: 'LCP', metric_value: 1850 },
      { metric_name: 'CLS', metric_value: 0.08 },
      { metric_name: 'INP', metric_value: 180 },
      { metric_name: 'FCP', metric_value: 1200 },
      { metric_name: 'TTFB', metric_value: 240 },
    ];
    for (const m of metrics) {
      trackWebVital({
        metric_name: m.metric_name,
        metric_value: m.metric_value,
        metric_rating: 'good',
        metric_id: `v4-${m.metric_name}-test`,
        navigation_type: 'navigate',
      });
    }
    expect(window.dataLayer).toHaveLength(5);
    for (let i = 0; i < metrics.length; i++) {
      expect(window.dataLayer[i]).toMatchObject({
        event: 'web_vital',
        metric_name: metrics[i].metric_name,
        metric_value: metrics[i].metric_value,
        metric_rating: 'good',
        navigation_type: 'navigate',
        iap_source: true,
        session_id: 'test-session-id',
      });
    }
  });

  it('carries metric_rating bucket and metric_id through the push', () => {
    trackWebVital({
      metric_name: 'LCP',
      metric_value: 4200,
      metric_rating: 'poor',
      metric_id: 'v4-LCP-1743000000000-9999',
      navigation_type: 'back-forward-cache',
    });
    expect(window.dataLayer[0]).toMatchObject({
      event: 'web_vital',
      metric_rating: 'poor',
      metric_id: 'v4-LCP-1743000000000-9999',
      navigation_type: 'back-forward-cache',
    });
  });
});

describe('trackPageEngagement (Phase 10d D3)', () => {
  it('pushes a page_engagement event with the threshold + max scroll percentage', () => {
    trackPageEngagement({ engagement_seconds: 15, max_scroll_pct: 42 });
    expect(window.dataLayer[0]).toMatchObject({
      event: 'page_engagement',
      engagement_seconds: 15,
      max_scroll_pct: 42,
      iap_source: true,
      session_id: 'test-session-id',
    });
  });

  it('carries each of the three threshold values through the push', () => {
    trackPageEngagement({ engagement_seconds: 15, max_scroll_pct: 0 });
    trackPageEngagement({ engagement_seconds: 60, max_scroll_pct: 50 });
    trackPageEngagement({ engagement_seconds: 180, max_scroll_pct: 100 });
    expect(window.dataLayer).toHaveLength(3);
    expect(
      (window.dataLayer as Array<{ engagement_seconds: number }>).map((e) => e.engagement_seconds),
    ).toEqual([15, 60, 180]);
  });
});

// `_iap_aid` is the cross-session visitor ID: a random UUID in a first-party
// cookie with a 365-day sliding expiry. Ian classified it Statistics in
// Cookiebot on 2026-11-14, and Cookiebot statistics is the analytics consent
// this module holds. A visitor who declines analytics, or has not chosen yet,
// must carry no year-long ID: the site neither mints, writes nor refreshes the
// cookie, and events carry an empty anonymous_id.
describe('anonymous_id follows analytics consent', () => {
  let aidWrites: string[];
  const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
  const readAid = () =>
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('_iap_aid='))
      ?.slice('_iap_aid='.length) ?? null;
  // Cookiebot removes a Statistics cookie when the visitor declines.
  const cookiebotDeletes = () => {
    document.cookie = '_iap_aid=; Max-Age=0; Path=/';
    aidWrites.length = 0;
  };
  const lastEvent = () => window.dataLayer[window.dataLayer.length - 1] as { anonymous_id: string };

  beforeEach(() => {
    initConsentState(false, false, false);
    aidWrites = [];
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookieDescriptor.get!.call(document),
      set: (v: string) => {
        if (v.startsWith('_iap_aid=')) aidWrites.push(v);
        cookieDescriptor.set!.call(document, v);
      },
    });
  });
  afterEach(() => {
    delete (document as unknown as { cookie?: string }).cookie;
    delete (navigator as unknown as { globalPrivacyControl?: unknown }).globalPrivacyControl;
    initConsentState(false, false, false);
  });

  it('gives a visitor who has not chosen yet no ID and no cookie', () => {
    // A fresh module: no banner choice has reached this page at all.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('@/lib/events/track') as typeof import('@/lib/events/track');
      fresh.trackPageView('/');
    });
    expect(lastEvent().anonymous_id).toBe('');
    expect(aidWrites).toEqual([]);
    expect(readAid()).toBeNull();
  });

  it('gives a visitor who declines analytics no ID and no cookie', () => {
    trackConsentUpdate(false, true, true);
    trackPageView('/');
    expect(window.dataLayer.map((e) => (e as { anonymous_id: string }).anonymous_id)).toEqual([
      '',
      '',
    ]);
    expect(aidWrites).toEqual([]);
    expect(readAid()).toBeNull();
  });

  it('neither refreshes nor re-mints a cookie Cookiebot deletes on decline', () => {
    document.cookie = '_iap_aid=left-from-earlier; Path=/';
    aidWrites.length = 0;
    trackConsentUpdate(false, false, false);
    expect(lastEvent().anonymous_id).toBe('');
    expect(aidWrites).toEqual([]);
    cookiebotDeletes();
    trackPageView('/');
    trackClickNav('Services', '/services');
    expect(lastEvent().anonymous_id).toBe('');
    expect(aidWrites).toEqual([]);
    expect(readAid()).toBeNull();
  });

  it('mints the cookie when analytics is granted and every later event carries it', () => {
    trackConsentUpdate(true, false, false);
    const minted = readAid();
    expect(minted).toBeTruthy();
    expect(lastEvent().anonymous_id).toBe(minted);
    trackPageView('/');
    expect(lastEvent().anonymous_id).toBe(minted);
  });

  it('mints the cookie for a returning visitor whose stored choice granted analytics', () => {
    // initConsentState pushes no event, so the grant itself must mint.
    initConsentState(true, false, false);
    expect(readAid()).toBeTruthy();
  });

  it('reuses an ID the visitor already has when analytics is granted', () => {
    document.cookie = '_iap_aid=test-anon-uuid; Path=/';
    initConsentState(true, false, false);
    trackPageView('/');
    expect(lastEvent().anonymous_id).toBe('test-anon-uuid');
    expect(readAid()).toBe('test-anon-uuid');
  });

  it('stops writing the cookie once the visitor withdraws analytics', () => {
    trackConsentUpdate(true, true, true);
    expect(readAid()).toBeTruthy();
    trackConsentUpdate(false, false, false);
    expect(lastEvent().anonymous_id).toBe('');
    cookiebotDeletes();
    trackPageView('/');
    trackFormStart('contact');
    expect(lastEvent().anonymous_id).toBe('');
    expect(aidWrites).toEqual([]);
    expect(readAid()).toBeNull();
  });

  // Global Privacy Control overrides marketing only; analytics keeps following
  // the banner. The ID follows the honored analytics choice, never marketing.
  it('follows the honored analytics choice when Global Privacy Control is on', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    trackConsentUpdate(false, true, false);
    expect(lastEvent().anonymous_id).toBe('');
    expect(aidWrites).toEqual([]);

    trackConsentUpdate(true, true, true);
    expect(lastEvent()).toMatchObject({ consent_marketing: false, consent_analytics: true });
    expect(lastEvent().anonymous_id).toBe(readAid());
    expect(readAid()).toBeTruthy();
  });
});
