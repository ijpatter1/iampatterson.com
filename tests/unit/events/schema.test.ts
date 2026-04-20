import { DATA_LAYER_EVENT_NAMES } from '@/lib/events/schema';
import type {
  BaseEvent,
  PageViewEvent,
  ScrollDepthEvent,
  ClickNavEvent,
  ClickCtaEvent,
  CtaLocation,
  FormFieldFocusEvent,
  FormStartEvent,
  FormSubmitEvent,
  ConsentUpdateEvent,
  DataLayerEvent,
  NavHintShownEvent,
  NavHintDismissedEvent,
  SessionPulseHoverEvent,
  OverviewTabViewEvent,
  PortalClickEvent,
  CoverageMilestoneEvent,
} from '@/lib/events/schema';

const baseFields = {
  iap_source: true,
  timestamp: '2026-03-26T12:00:00.000Z',
  session_id: 'abc-123',
  iap_session_id: 'abc-123',
  page_path: '/',
  page_title: 'Home',
  consent_analytics: true,
  consent_marketing: false,
  consent_preferences: true,
} as const;

describe('Event schema types', () => {
  it('defines a valid BaseEvent shape', () => {
    const event: BaseEvent = {
      ...baseFields,
      event: 'page_view',
    };
    expect(event.event).toBe('page_view');
    expect(event.timestamp).toBeTruthy();
    expect(event.session_id).toBeTruthy();
    expect(event.page_path).toBe('/');
    expect(event.page_title).toBe('Home');
  });

  it('defines PageViewEvent with page_referrer', () => {
    const event: PageViewEvent = {
      ...baseFields,
      event: 'page_view',
      page_referrer: '/about',
    };
    expect(event.page_referrer).toBe('/about');
  });

  it('defines ScrollDepthEvent with depth fields', () => {
    const event: ScrollDepthEvent = {
      ...baseFields,
      event: 'scroll_depth',
      depth_percentage: 50,
      depth_pixels: 1200,
    };
    expect(event.depth_percentage).toBe(50);
    expect(event.depth_pixels).toBe(1200);
  });

  it('defines ClickNavEvent with link fields', () => {
    const event: ClickNavEvent = {
      ...baseFields,
      event: 'click_nav',
      link_text: 'Services',
      link_url: '/services',
    };
    expect(event.link_text).toBe('Services');
    expect(event.link_url).toBe('/services');
  });

  it('defines ClickCtaEvent with cta fields and typed CtaLocation', () => {
    const event: ClickCtaEvent = {
      ...baseFields,
      event: 'click_cta',
      cta_text: 'See how it works',
      cta_location: 'hero',
    };
    expect(event.cta_text).toBe('See how it works');
    expect(event.cta_location).toBe('hero');
  });

  it('CtaLocation covers the 7-value nav-adjacent closed enum', () => {
    // Type-level: Record<NavAdjacent, true> requires exactly these seven keys.
    type NavAdjacent = Extract<
      CtaLocation,
      | 'session_pulse'
      | 'portal_services'
      | 'portal_about'
      | 'portal_contact'
      | 'contact_cta_threshold'
      | 'pipeline_see_your_session'
      | 'footer_session'
    >;
    const navAdjacent: Record<NavAdjacent, true> = {
      session_pulse: true,
      portal_services: true,
      portal_about: true,
      portal_contact: true,
      contact_cta_threshold: true,
      pipeline_see_your_session: true,
      footer_session: true,
    };
    expect(Object.keys(navAdjacent)).toHaveLength(7);
  });

  it('defines FormFieldFocusEvent with form and field name', () => {
    const event: FormFieldFocusEvent = {
      ...baseFields,
      event: 'form_field_focus',
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
      ...baseFields,
      event: 'form_start',
      page_path: '/contact',
      page_title: 'Contact',
      form_name: 'contact',
    };
    expect(event.form_name).toBe('contact');
  });

  it('defines FormSubmitEvent with form_name and form_success', () => {
    const event: FormSubmitEvent = {
      ...baseFields,
      event: 'form_submit',
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
      ...baseFields,
      event: 'consent_update',
      consent_analytics: true,
      consent_marketing: false,
      consent_preferences: true,
    };
    expect(event.consent_analytics).toBe(true);
    expect(event.consent_marketing).toBe(false);
    expect(event.consent_preferences).toBe(true);
  });

  // --- Phase 9E deliverable 9 — nav & Session State analytics ---

  it('defines NavHintShownEvent with base fields only', () => {
    const event: NavHintShownEvent = {
      ...baseFields,
      event: 'nav_hint_shown',
    };
    expect(event.event).toBe('nav_hint_shown');
  });

  it('defines NavHintDismissedEvent with all four dismissal_mode values', () => {
    const byScroll: NavHintDismissedEvent = {
      ...baseFields,
      event: 'nav_hint_dismissed',
      dismissal_mode: 'scroll',
    };
    const byPulseClick: NavHintDismissedEvent = {
      ...byScroll,
      dismissal_mode: 'click_session_pulse',
    };
    const byOutsideClick: NavHintDismissedEvent = { ...byScroll, dismissal_mode: 'click_outside' };
    const byTimeout: NavHintDismissedEvent = { ...byScroll, dismissal_mode: 'timeout' };
    expect(byScroll.dismissal_mode).toBe('scroll');
    expect(byPulseClick.dismissal_mode).toBe('click_session_pulse');
    expect(byOutsideClick.dismissal_mode).toBe('click_outside');
    expect(byTimeout.dismissal_mode).toBe('timeout');
  });

  it('defines SessionPulseHoverEvent with base fields only', () => {
    const event: SessionPulseHoverEvent = {
      ...baseFields,
      event: 'session_pulse_hover',
    };
    expect(event.event).toBe('session_pulse_hover');
  });

  it('defines OverviewTabViewEvent with default_landing and manual_select sources', () => {
    const onOpen: OverviewTabViewEvent = {
      ...baseFields,
      event: 'overview_tab_view',
      source: 'default_landing',
    };
    const byReselect: OverviewTabViewEvent = { ...onOpen, source: 'manual_select' };
    expect(onOpen.source).toBe('default_landing');
    expect(byReselect.source).toBe('manual_select');
  });

  it('defines PortalClickEvent with services, about, and contact destinations', () => {
    const toServices: PortalClickEvent = {
      ...baseFields,
      event: 'portal_click',
      destination: 'services',
    };
    const toAbout: PortalClickEvent = { ...toServices, destination: 'about' };
    const toContact: PortalClickEvent = { ...toServices, destination: 'contact' };
    expect(toServices.destination).toBe('services');
    expect(toAbout.destination).toBe('about');
    expect(toContact.destination).toBe('contact');
  });

  it('defines CoverageMilestoneEvent with 25/50/75/100 threshold union', () => {
    const quarter: CoverageMilestoneEvent = {
      ...baseFields,
      event: 'coverage_milestone',
      threshold: 25,
    };
    const half: CoverageMilestoneEvent = { ...quarter, threshold: 50 };
    const threeQuarter: CoverageMilestoneEvent = { ...quarter, threshold: 75 };
    const complete: CoverageMilestoneEvent = { ...quarter, threshold: 100 };
    expect(quarter.threshold).toBe(25);
    expect(half.threshold).toBe(50);
    expect(threeQuarter.threshold).toBe(75);
    expect(complete.threshold).toBe(100);
  });

  it('DataLayerEvent union is exhaustive against DATA_LAYER_EVENT_NAMES (no drift)', () => {
    // Type-level exhaustive check: Record<DataLayerEvent['event'], true> requires every literal
    // value of the union's `event` discriminator as a key. Missing keys fail type-check;
    // extra keys fail excess-property check. Combined with the _AssertEventNamesInSync sentinel
    // in schema.ts, this triangulates: runtime array, type union, and this test all agree
    // on the same set of event names.
    //
    // DO NOT REPLACE this explicit-literal Record with a DATA_LAYER_EVENT_NAMES-derived
    // iteration — the type-level exhaustiveness check is the whole point of the hand-list.
    // Replace the literal and the drift-catching property of the test disappears silently.
    const allEventNames: Record<DataLayerEvent['event'], true> = {
      page_view: true,
      scroll_depth: true,
      click_nav: true,
      click_cta: true,
      form_field_focus: true,
      form_start: true,
      form_submit: true,
      consent_update: true,
      product_view: true,
      add_to_cart: true,
      begin_checkout: true,
      purchase: true,
      plan_select: true,
      trial_signup: true,
      form_complete: true,
      lead_qualify: true,
      nav_hint_shown: true,
      nav_hint_dismissed: true,
      session_pulse_hover: true,
      overview_tab_view: true,
      portal_click: true,
      coverage_milestone: true,
    };
    // Runtime assertion derives the expected count from the schema's own source of truth —
    // extending DATA_LAYER_EVENT_NAMES is the single edit needed; this test re-derives.
    expect(Object.keys(allEventNames)).toHaveLength(DATA_LAYER_EVENT_NAMES.length);
    // Sanity: the set of names rendered here matches the schema's runtime array.
    expect(Object.keys(allEventNames).sort()).toEqual([...DATA_LAYER_EVENT_NAMES].sort());
  });
});
