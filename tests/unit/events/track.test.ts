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

  // Phase 10d D7: every event carries `anonymous_id` from the `_iap_aid`
  // first-party cookie alongside the session-scoped `session_id`. The base
  // fields helper threads it through automatically, so this regression
  // pin on page_view also covers every other tracker that uses baseFields().
  it('threads anonymous_id from the _iap_aid cookie into the data-layer push', () => {
    document.cookie = '_iap_aid=test-anon-uuid; Path=/';
    trackPageView('/');
    expect(window.dataLayer[0]).toMatchObject({
      event: 'page_view',
      anonymous_id: 'test-anon-uuid',
    });
  });

  it('mints a fresh anonymous_id on first call when the _iap_aid cookie is empty', () => {
    // Cookie cleared by beforeEach. The file-level crypto.randomUUID mock returns
    // 'test-session-id' for every call, so the freshly-minted anonymous_id ends
    // up as that same value — the assertion proves "mint happened" rather than
    // pinning a real UUID format.
    trackPageView('/');
    const event = window.dataLayer[0] as { anonymous_id: string };
    expect(event.anonymous_id).toBe('test-session-id');
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
