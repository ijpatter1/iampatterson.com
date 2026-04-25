import {
  DATA_LAYER_EVENT_NAMES,
  HIDDEN_FROM_COVERAGE,
  RENDERABLE_EVENT_NAMES,
} from '@/lib/events/schema';
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
  WebVitalEvent,
} from '@/lib/events/schema';

const baseFields = {
  iap_source: true,
  timestamp: '2026-03-26T12:00:00.000Z',
  session_id: 'abc-123',
  iap_session_id: 'abc-123',
  // Phase 10d D7: BaseEvent gained anonymous_id (the _iap_aid cross-session id).
  anonymous_id: 'aid-deadbeef',
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

  it('CtaLocation covers the editorial closed enum', () => {
    // Parallel sentinel to the nav-adjacent one above. Guards the editorial /
    // page-specific side of the CtaLocation union against silent drop or rename.
    // Template-literal `services_tier_${N}` values are enumerated explicitly as
    // their four concrete strings so the Extract<> evaluates correctly.
    type Editorial = Extract<
      CtaLocation,
      | 'hero'
      | 'services_closer'
      | 'services_tier_01'
      | 'services_tier_02'
      | 'services_tier_03'
      | 'services_tier_04'
      | 'final_cta'
      | 'about_closer'
      | 'demo_card_ecommerce'
    >;
    const editorial: Record<Editorial, true> = {
      hero: true,
      services_closer: true,
      services_tier_01: true,
      services_tier_02: true,
      services_tier_03: true,
      services_tier_04: true,
      final_cta: true,
      about_closer: true,
      demo_card_ecommerce: true,
    };
    expect(Object.keys(editorial)).toHaveLength(9);
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

  // --- Phase 9E deliverable 9, nav & Session State analytics ---

  it('defines NavHintShownEvent with base fields only', () => {
    const event: NavHintShownEvent = {
      ...baseFields,
      event: 'nav_hint_shown',
    };
    expect(event.event).toBe('nav_hint_shown');
  });

  it('defines NavHintDismissedEvent with three dismissal_mode values (click_session_pulse removed post-UAT, clicks on SessionPulse are conversions, not dismissals)', () => {
    const byScroll: NavHintDismissedEvent = {
      ...baseFields,
      event: 'nav_hint_dismissed',
      dismissal_mode: 'scroll',
    };
    const byOutsideClick: NavHintDismissedEvent = { ...byScroll, dismissal_mode: 'click_outside' };
    const byTimeout: NavHintDismissedEvent = { ...byScroll, dismissal_mode: 'timeout' };
    expect(byScroll.dismissal_mode).toBe('scroll');
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

  // --- Phase 10 D1, Core Web Vitals telemetry ---

  it('defines WebVitalEvent with the five CWV metric names and rating buckets', () => {
    const lcp: WebVitalEvent = {
      ...baseFields,
      event: 'web_vital',
      metric_name: 'LCP',
      metric_value: 1850,
      metric_rating: 'good',
      metric_id: 'v4-1743000000000-1234567890',
      navigation_type: 'navigate',
    };
    const cls: WebVitalEvent = { ...lcp, metric_name: 'CLS', metric_value: 0.08 };
    const inp: WebVitalEvent = { ...lcp, metric_name: 'INP', metric_value: 180 };
    const fcp: WebVitalEvent = { ...lcp, metric_name: 'FCP', metric_value: 1200 };
    const ttfb: WebVitalEvent = { ...lcp, metric_name: 'TTFB', metric_value: 240 };
    const poor: WebVitalEvent = {
      ...lcp,
      metric_rating: 'poor',
      metric_value: 5200,
      metric_name: 'LCP',
    };
    const needs: WebVitalEvent = {
      ...lcp,
      metric_rating: 'needs-improvement',
      metric_value: 3000,
      metric_name: 'LCP',
    };
    expect([
      lcp.metric_name,
      cls.metric_name,
      inp.metric_name,
      fcp.metric_name,
      ttfb.metric_name,
    ]).toEqual(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']);
    expect([lcp.metric_rating, needs.metric_rating, poor.metric_rating]).toEqual([
      'good',
      'needs-improvement',
      'poor',
    ]);
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
    // iteration, the type-level exhaustiveness check is the whole point of the hand-list.
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
      remove_from_cart: true,
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
      timeline_tab_view: true,
      consent_tab_view: true,
      portal_click: true,
      coverage_milestone: true,
      web_vital: true,
    };
    // Runtime assertion derives the expected count from the schema's own source of truth,
    // extending DATA_LAYER_EVENT_NAMES is the single edit needed; this test re-derives.
    expect(Object.keys(allEventNames)).toHaveLength(DATA_LAYER_EVENT_NAMES.length);
    // Sanity: the set of names rendered here matches the schema's runtime array.
    expect(Object.keys(allEventNames).sort()).toEqual([...DATA_LAYER_EVENT_NAMES].sort());
  });

  it('RENDERABLE_EVENT_NAMES excludes sub/leadgen events', () => {
    // F2 hide: chips for events no current demo surface can trigger (the
    // subscription + lead-gen demos were removed in 9E). Re-introducing
    // those demos re-renders the chips without any schema change. `web_vital`
    // was in this hidden set through 10b + 10c; unhidden post-merge per
    // user direction — the session is everything that flows through the
    // stack during the visitor's time on the site, not only interaction
    // events (nav hints, coverage milestones, and overview tab views all
    // render without explicit participation).
    const hidden = ['plan_select', 'trial_signup', 'form_complete', 'lead_qualify'];
    for (const name of hidden) {
      expect(RENDERABLE_EVENT_NAMES).not.toContain(name);
    }
    expect(RENDERABLE_EVENT_NAMES).toContain('web_vital');
    const expected = DATA_LAYER_EVENT_NAMES.filter(
      (n) => !hidden.includes(n as (typeof hidden)[number]),
    );
    expect([...RENDERABLE_EVENT_NAMES]).toEqual(expected);
  });

  it('RENDERABLE_EVENT_NAMES includes the timeline_tab_view and consent_tab_view additions (F2)', () => {
    expect(RENDERABLE_EVENT_NAMES).toContain('timeline_tab_view');
    expect(RENDERABLE_EVENT_NAMES).toContain('consent_tab_view');
  });

  it('RENDERABLE_EVENT_NAMES is a strict subset of DATA_LAYER_EVENT_NAMES', () => {
    // Guards the RENDERABLE → DATA_LAYER direction: no renderable chip
    // references a name that isn't in the live schema.
    const dl = new Set<string>(DATA_LAYER_EVENT_NAMES);
    for (const name of RENDERABLE_EVENT_NAMES) {
      expect(dl.has(name)).toBe(true);
    }
    expect(new Set(RENDERABLE_EVENT_NAMES).size).toBe(RENDERABLE_EVENT_NAMES.length);
  });

  it('HIDDEN_FROM_COVERAGE ⊆ DATA_LAYER_EVENT_NAMES, catches typos in the hide list (F8 eval re-fix)', () => {
    // The previous subset-check-as-written only caught mistakes in the
    // RENDERABLE direction. The actual HIDDEN-typo failure mode is:
    // a bad entry like `plan_selekt` in HIDDEN doesn't match any real
    // event, so `filter(!HIDDEN.has(n))` doesn't strip the real
    // `plan_select`, and RENDERABLE accidentally includes it. That
    // leaves RENDERABLE ⊆ DATA_LAYER still true, the regression is
    // visible only as a missing chip-grid hide, with no assertion
    // failure.
    // This test iterates HIDDEN and asserts each entry is in the live
    // schema, catches the typo at runtime and restores the CI backstop
    // for the `Set<DataLayerEventName>` compile-time type (which is
    // only enforced by `tsc --noEmit`, not the CI build).
    const dl = new Set<string>(DATA_LAYER_EVENT_NAMES);
    for (const name of HIDDEN_FROM_COVERAGE) {
      expect(dl.has(name)).toBe(true);
    }
  });
});
