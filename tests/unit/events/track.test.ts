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
} from '@/lib/events/track';

// Mock crypto.randomUUID for session ID
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-session-id' },
});

beforeEach(() => {
  window.dataLayer = [];
  // Clear session cookie
  document.cookie = '_iap_sid=; Max-Age=0; Path=/';
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
