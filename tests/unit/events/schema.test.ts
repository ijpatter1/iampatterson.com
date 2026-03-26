import type {
  BaseEvent,
  PageViewEvent,
  ScrollDepthEvent,
  ClickNavEvent,
  ClickCtaEvent,
  FormFieldFocusEvent,
  FormStartEvent,
  FormSubmitEvent,
  ConsentUpdateEvent,
} from '@/lib/events/schema';

describe('Event schema types', () => {
  it('defines a valid BaseEvent shape', () => {
    const event: BaseEvent = {
      event: 'page_view',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/',
      page_title: 'Home',
    };
    expect(event.event).toBe('page_view');
    expect(event.timestamp).toBeTruthy();
    expect(event.session_id).toBeTruthy();
    expect(event.page_path).toBe('/');
    expect(event.page_title).toBe('Home');
  });

  it('defines PageViewEvent with page_referrer', () => {
    const event: PageViewEvent = {
      event: 'page_view',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/',
      page_title: 'Home',
      page_referrer: '/about',
    };
    expect(event.page_referrer).toBe('/about');
  });

  it('defines ScrollDepthEvent with depth fields', () => {
    const event: ScrollDepthEvent = {
      event: 'scroll_depth',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/',
      page_title: 'Home',
      depth_percentage: 50,
      depth_pixels: 1200,
    };
    expect(event.depth_percentage).toBe(50);
    expect(event.depth_pixels).toBe(1200);
  });

  it('defines ClickNavEvent with link fields', () => {
    const event: ClickNavEvent = {
      event: 'click_nav',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/',
      page_title: 'Home',
      link_text: 'Services',
      link_url: '/services',
    };
    expect(event.link_text).toBe('Services');
    expect(event.link_url).toBe('/services');
  });

  it('defines ClickCtaEvent with cta fields', () => {
    const event: ClickCtaEvent = {
      event: 'click_cta',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/',
      page_title: 'Home',
      cta_text: 'See how it works',
      cta_location: 'hero',
    };
    expect(event.cta_text).toBe('See how it works');
    expect(event.cta_location).toBe('hero');
  });

  it('defines FormFieldFocusEvent with form and field name', () => {
    const event: FormFieldFocusEvent = {
      event: 'form_field_focus',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/contact',
      page_title: 'Contact',
      form_name: 'contact',
      field_name: 'email',
    };
    expect(event.form_name).toBe('contact');
    expect(event.field_name).toBe('email');
  });

  it('defines FormStartEvent with form_name', () => {
    const event: FormStartEvent = {
      event: 'form_start',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/contact',
      page_title: 'Contact',
      form_name: 'contact',
    };
    expect(event.form_name).toBe('contact');
  });

  it('defines FormSubmitEvent with form_name and form_success', () => {
    const event: FormSubmitEvent = {
      event: 'form_submit',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/contact',
      page_title: 'Contact',
      form_name: 'contact',
      form_success: true,
    };
    expect(event.form_name).toBe('contact');
    expect(event.form_success).toBe(true);
  });

  it('defines ConsentUpdateEvent with consent fields', () => {
    const event: ConsentUpdateEvent = {
      event: 'consent_update',
      timestamp: '2026-03-26T12:00:00.000Z',
      session_id: 'abc-123',
      page_path: '/',
      page_title: 'Home',
      consent_analytics: true,
      consent_marketing: false,
      consent_preferences: true,
    };
    expect(event.consent_analytics).toBe(true);
    expect(event.consent_marketing).toBe(false);
    expect(event.consent_preferences).toBe(true);
  });
});
