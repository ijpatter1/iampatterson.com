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
} from '@/lib/events/track';

// Mock crypto.randomUUID for session ID
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-session-id' },
});

beforeEach(() => {
  window.dataLayer = [];
  sessionStorage.clear();
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
