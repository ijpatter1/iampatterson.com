import {
  ANONYMOUS_ID_COOKIE_NAME,
  ANONYMOUS_ID_MAX_AGE,
  readAnonymousIdCookie,
} from '@/lib/identity/anonymous-id';
import { isGlobalPrivacyControlEnabled } from './global-privacy-control';
import { pushEvent } from './push';
import { readStoredConsent } from './stored-consent';
import type {
  CoverageMilestoneEvent,
  CtaLocation,
  NavHintDismissedEvent,
  PageEngagementEvent,
  PortalClickEvent,
  WebVitalEvent,
  ClaudishTranslateEvent,
  ClaudishDetectedEvent,
  ClaudishShareEvent,
  ClaudishRateEvent,
  ClaudishSamplePickEvent,
} from './schema';
import { getSessionId } from './session';

/** Current consent state, updated by trackConsentUpdate and initConsentState. */
let currentConsent = {
  consent_analytics: false,
  consent_marketing: false,
  consent_preferences: false,
};

/**
 * Whether this page load has taken its consent from the stored cookie or from
 * Cookiebot yet. See applyStoredConsent.
 */
let storedConsentRead = false;

/**
 * `_iap_aid`, the 365-day visitor ID, is a Statistics cookie (Ian,
 * 2026-11-14): it exists only while analytics consent is granted. These
 * writers are private to this module and run only from
 * `applyAnonymousIdConsent`, which mints only on a grant. So nothing can mint
 * the ID without the visitor's consent. See `src/lib/identity/anonymous-id.ts`.
 */
function anonymousIdCookie(value: string, maxAge: number): string {
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  return `${ANONYMOUS_ID_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/**
 * A new random ID, or '' where the browser cannot make one: `randomUUID` is
 * missing outside secure contexts, and a throw here must not stop consent.
 */
function newAnonymousId(): string {
  try {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : '';
  } catch {
    return '';
  }
}

/**
 * Mint the cookie, or reuse the one already there, and refresh its expiry.
 * Returns the ID only if the cookie actually holds it afterwards: when the
 * browser refuses the write, or no ID can be made, it returns '' so no event
 * carries an ID the visitor's browser does not have.
 */
function ensureAnonymousIdCookie(): string {
  const id = readAnonymousIdCookie() || newAnonymousId();
  if (!id) return '';
  document.cookie = anonymousIdCookie(id, ANONYMOUS_ID_MAX_AGE);
  return readAnonymousIdCookie() === id ? id : '';
}

/**
 * Expire the cookie on a decline or withdrawal. Cookiebot deletes it too, but
 * a decliner must not keep the ID whatever Cookiebot does or when.
 */
function clearAnonymousIdCookie(): void {
  if (readAnonymousIdCookie() === null) return;
  document.cookie = anonymousIdCookie('', 0);
}

/**
 * The ID this tab established while analytics consent is granted, '' otherwise.
 * Cleared in recordConsent, set in applyAnonymousIdConsent, read through
 * `emittedAnonymousId`.
 */
let consentedAnonymousId = '';

/**
 * The ID an event carries: this tab's consented ID, but only while the cookie
 * still holds it. If another tab withdrew (the cookie is gone) or the cookie
 * now holds a different ID, this tab carries '' rather than a phantom ID.
 */
function emittedAnonymousId(): string {
  if (!consentedAnonymousId) return '';
  return readAnonymousIdCookie() === consentedAnonymousId ? consentedAnonymousId : '';
}

type GtagFn = {
  (command: 'consent', action: 'update', payload: Record<string, 'granted' | 'denied'>): void;
  (command: 'set', key: 'ads_data_redaction', value: boolean): void;
};

/**
 * Global Privacy Control wins over the banner for marketing consent. A visitor
 * who sent the signal and then clicked "Allow all" still has marketing
 * declined: the three advertising signals stay denied and `consent_marketing`
 * is false on every event. Analytics and preferences are not what the signal
 * speaks to and keep following the banner.
 *
 * This holds only because the bridge below is the single writer of Consent
 * Mode after page load: Cookiebot's own writes are switched off on its script
 * tag (`data-consentmode="disabled"` in `cookiebot.tsx`). The one writer
 * before GTM loads, the stored-consent update in the consent defaults
 * (`STORED_CONSENT_UPDATE_JS`, 15.8), applies the same rule.
 */
function honorGlobalPrivacyControl(marketing: boolean): boolean {
  return marketing && !isGlobalPrivacyControlEnabled();
}

/**
 * The one place a banner choice becomes the site's consent state. Both entry
 * points go through it, so the Global Privacy Control override cannot be
 * skipped by a path that sets consent some other way.
 */
function recordConsent(
  analytics: boolean,
  marketing: boolean,
  preferences: boolean,
): typeof currentConsent {
  // An answer from Cookiebot supersedes the stored cookie for this page load.
  storedConsentRead = true;
  currentConsent = {
    consent_analytics: analytics,
    consent_marketing: honorGlobalPrivacyControl(marketing),
    consent_preferences: preferences,
  };
  // Without analytics, no event carries an ID from here on, including the
  // consent_update about to be pushed for a withdrawal.
  if (!currentConsent.consent_analytics) consentedAnonymousId = '';
  return currentConsent;
}

/**
 * The one place `_iap_aid` is written. Runs after the consent
 * has reached Google (the gtag update, and the consent_update push for a
 * choice), so nothing here can hold that up.
 *
 * - Granted: mint the cookie, or reuse and refresh the one already there,
 *   including for a returning visitor whose silent initConsentState pushes no
 *   event.
 * - Not granted, once Cookiebot has a resolved answer: expire it. That is
 *   every `trackConsentUpdate` (the visitor's decline or withdrawal, or
 *   Cookiebot's decline event for a stored choice), and `initConsentState`
 *   called with `resolved` (a stored answer already in place, or Cookiebot's
 *   answer with `hasResponse === false` for a visitor who has never chosen),
 *   and applyStoredConsent for a stored decline. Production minted the cookie
 *   for every visitor until 2026-11-14, so leftovers exist.
 * - Not granted, before Cookiebot has resolved: leave it. On a reload
 *   initConsentState runs at ~15ms with no answer yet (measured 2026-11-14);
 *   the stored choice arrives ~180ms later. Expiring there would delete a
 *   consenting visitor's ID and mint a new one when CookiebotOnAccept follows.
 */
function applyAnonymousIdConsent(resolved: boolean): void {
  if (typeof document === 'undefined') return;
  if (currentConsent.consent_analytics) {
    consentedAnonymousId = ensureAnonymousIdCookie();
  } else if (resolved) {
    clearAnonymousIdCookie();
  }
}

/**
 * Take a returning visitor's stored choice from Cookiebot's `CookieConsent`
 * cookie, before Cookiebot has resolved it (15.8). On a reload Cookiebot has
 * no answer for ~180ms (measured in production, 2026-11-14), and the landing
 * page_view and the first scroll and web-vital events can fire inside that
 * window. Without this they carried the denied defaults and no visitor ID.
 *
 * Runs once per page load, from the listener's mount or before the first
 * event, whichever comes first, and never after Cookiebot has answered: recordConsent
 * marks it done. A choice made in another tab later is not picked up here,
 * because this tab's tags do not have it either.
 *
 * It sends no gtag update: the inline script ahead of GTM
 * (`STORED_CONSENT_UPDATE_JS` in the consent defaults) already sent this
 * choice, read from the same cookie with the same patterns. It pushes no
 * `consent_update`: the visitor changed nothing on this page load.
 *
 * A stored choice is a resolved answer, so a stored decline expires a
 * leftover `_iap_aid` here; until 15.8 that rode the reload's
 * `consent_update`. No stored choice: nothing happens, and Cookiebot's own
 * answer owns the leftover (the listener records `hasResponse === false`).
 */
export function applyStoredConsent(): void {
  if (storedConsentRead || typeof document === 'undefined') return;
  storedConsentRead = true;
  const stored = readStoredConsent(document.cookie);
  if (!stored) return;
  recordConsent(stored.analytics, stored.marketing, stored.preferences);
  applyAnonymousIdConsent(true);
}

/**
 * Bridge Cookiebot's three booleans to GTM Consent Mode v2's six gtag signals
 * and call `gtag('consent', 'update', {...})`. This is the explicit
 * replacement for what `data-blockingmode="auto"` used to do implicitly —
 * see `docs/ARCHITECTURE.md` "Cookiebot + GTM Consent Mode" for the full
 * mapping rationale and the architectural amendment.
 *
 * Mapping:
 *   Cookiebot statistics  → analytics_storage
 *   Cookiebot marketing   → ad_storage + ad_user_data + ad_personalization
 *   Cookiebot preferences → functionality_storage + personalization_storage
 *   security_storage stays granted via the consent-defaults inline script
 *   (not bridged here — Cookiebot has no corresponding category).
 *
 * Silently no-ops when `window.gtag` isn't defined (SSR, or pre-GTM-init
 * paths) — the gtag stub is created by the consent-defaults inline script
 * during HTML parse, so by the time CookiebotConsentListener fires this
 * call gtag should always exist; the guard is defence in depth.
 */
function bridgeToGtagConsent(analytics: boolean, marketing: boolean, preferences: boolean): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== 'function') return;
  const yn = (b: boolean): 'granted' | 'denied' => (b ? 'granted' : 'denied');
  // Cookiebot's loader used to set this from the marketing choice. With its
  // Consent Mode writes off, the bridge owns it: ad click identifiers are
  // redacted unless marketing consent is granted. Set before the update, so a
  // withdrawal is never processed with redaction still off.
  gtag('set', 'ads_data_redaction', !marketing);
  gtag('consent', 'update', {
    analytics_storage: yn(analytics),
    ad_storage: yn(marketing),
    ad_user_data: yn(marketing),
    ad_personalization: yn(marketing),
    functionality_storage: yn(preferences),
    personalization_storage: yn(preferences),
  });
}

/**
 * The Consent Mode state the page has sent so far: every `gtag('consent',
 * 'default' | 'update', …)` call in the data layer, in order, later ones
 * winning. Read from the data layer rather than remembered here, so it counts
 * the inline script's stored-consent update and nothing this module only
 * assumes was sent. Each writer sets `ads_data_redaction` from marketing, so
 * the six signals cover it.
 */
function consentInForce(): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const entry of window.dataLayer ?? []) {
    const e = entry as Record<number, unknown> | null;
    if (!e || typeof e !== 'object' || e[0] !== 'consent') continue;
    if ((e[1] === 'default' || e[1] === 'update') && e[2] && typeof e[2] === 'object') {
      Object.assign(state, e[2]);
    }
  }
  return state;
}

/**
 * Whether Consent Mode already has what the bridge would send for these
 * choices: the same mapping as bridgeToGtagConsent, which a test checks
 * against the bridge's own calls.
 */
function alreadyInForce(analytics: boolean, marketing: boolean, preferences: boolean): boolean {
  const inForce = consentInForce();
  const yn = (b: boolean) => (b ? 'granted' : 'denied');
  return (
    inForce.analytics_storage === yn(analytics) &&
    inForce.ad_storage === yn(marketing) &&
    inForce.ad_user_data === yn(marketing) &&
    inForce.ad_personalization === yn(marketing) &&
    inForce.functionality_storage === yn(preferences) &&
    inForce.personalization_storage === yn(preferences)
  );
}

/**
 * Record consent Cookiebot reports without the visitor choosing on this page:
 * its resolved answer at mount, its replay of a stored choice
 * (`Cookiebot.changed === false`), and its answer when it has none
 * (`hasResponse === false`: a visitor who has never chosen, a stored choice it
 * rejected, or implied consent in an opt-out region) (15.8). Bridges to gtag
 * only when Consent Mode does not already have this state: the replay of a
 * choice the inline script sent ahead of GTM sends nothing.
 *
 * Silent vs trackConsentUpdate — does NOT push a `consent_update` data-
 * layer event. The under-the-hood Timeline shouldn't show a "consent
 * changed" event for a returning visitor whose consent didn't actually
 * change this session; the gtag bridge is the only side effect.
 *
 * `resolved` is true only when Cookiebot has a resolved answer
 * (`Cookiebot.hasResponse === true`). Only then may an analytics-false state
 * expire a leftover `_iap_aid`; see applyAnonymousIdConsent.
 */
export function initConsentState(
  analytics: boolean,
  marketing: boolean,
  preferences: boolean,
  resolved = false,
): void {
  const honored = recordConsent(analytics, marketing, preferences);
  const { consent_analytics: a, consent_marketing: m, consent_preferences: p } = honored;
  if (!alreadyInForce(a, m, p)) bridgeToGtagConsent(a, m, p);
  applyAnonymousIdConsent(resolved);
}

/**
 * Read the module's current consent snapshot. The returned object is a copy,
 * safe to pass into a pure reducer without aliasing the mutable module state.
 */
export function getCurrentConsent(): {
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
} {
  return { ...currentConsent };
}

function baseFields(): {
  iap_source: true;
  timestamp: string;
  session_id: string;
  iap_session_id: string;
  anonymous_id: string;
  page_path: string;
  page_title: string;
  consent_analytics: boolean;
  consent_marketing: boolean;
  consent_preferences: boolean;
} {
  applyStoredConsent();
  const sid = getSessionId();
  return {
    iap_source: true,
    timestamp: new Date().toISOString(),
    session_id: sid,
    iap_session_id: sid,
    // Read only, and empty without analytics consent: see emittedAnonymousId.
    anonymous_id: emittedAnonymousId(),
    page_path: window.location.pathname,
    page_title: document.title,
    ...currentConsent,
  };
}

/**
 * This page's page_view, if it was pushed while analytics was denied, and
 * whether one has been sent again on this page load. See
 * resendPageViewAfterGrant.
 */
let deniedPageView: { path: string; referrer: string } | null = null;
let pageViewResent = false;

export function trackPageView(referrer: string): void {
  const fields = baseFields();
  pushEvent({ ...fields, event: 'page_view', page_referrer: referrer });
  deniedPageView = fields.consent_analytics ? null : { path: fields.page_path, referrer };
}

/**
 * A first-time visitor's landing page_view is pushed while consent is denied,
 * and GTM blocks its tag; GTM does not fire it again on a later grant
 * (measured on localhost, 2026-11-15). When the visitor grants analytics in
 * the banner on that page, the page is pushed again, with the referrer it was
 * pushed with (the document's on the landing page, the previous path after a
 * client-side navigation), once per page load (15.8).
 */
function resendPageViewAfterGrant(): void {
  if (pageViewResent || !deniedPageView) return;
  if (deniedPageView.path !== window.location.pathname) return;
  pageViewResent = true;
  const { referrer } = deniedPageView;
  deniedPageView = null;
  pushEvent({ ...baseFields(), event: 'page_view', page_referrer: referrer });
}

export function trackClickNav(linkText: string, linkUrl: string): void {
  pushEvent({ ...baseFields(), event: 'click_nav', link_text: linkText, link_url: linkUrl });
}

export function trackClickCta(ctaText: string, ctaLocation: CtaLocation): void {
  pushEvent({ ...baseFields(), event: 'click_cta', cta_text: ctaText, cta_location: ctaLocation });
}

export function trackFormFieldFocus(formName: string, fieldName: string): void {
  pushEvent({
    ...baseFields(),
    event: 'form_field_focus',
    form_name: formName,
    field_name: fieldName,
  });
}

export function trackFormStart(formName: string): void {
  pushEvent({ ...baseFields(), event: 'form_start', form_name: formName });
}

export function trackFormSubmit(formName: string, success: boolean): void {
  pushEvent({ ...baseFields(), event: 'form_submit', form_name: formName, form_success: success });
}

export function trackScrollDepth(percentage: number, pixels: number): void {
  pushEvent({
    ...baseFields(),
    event: 'scroll_depth',
    depth_percentage: percentage,
    depth_pixels: pixels,
  });
}

/**
 * A choice: pushes `consent_update`. `submitted` is true when Cookiebot reports
 * the visitor submitted the banner on this page (`Cookiebot.changed === true`);
 * a submission that takes analytics from denied to granted sends this page's
 * blocked page_view again (resendPageViewAfterGrant).
 */
export function trackConsentUpdate(
  analytics: boolean,
  marketing: boolean,
  preferences: boolean,
  submitted = false,
): void {
  const hadAnalytics = currentConsent.consent_analytics;
  const honored = recordConsent(analytics, marketing, preferences);
  // The consent update is queued first: GTM judges the tags on the
  // consent_update event against the state in force when it reaches it.
  bridgeToGtagConsent(
    honored.consent_analytics,
    honored.consent_marketing,
    honored.consent_preferences,
  );
  pushEvent({
    ...baseFields(),
    event: 'consent_update',
  });
  applyAnonymousIdConsent(true);
  if (submitted && !hadAnalytics && currentConsent.consent_analytics) resendPageViewAfterGrant();
}

// --- E-commerce demo tracking (Phase 6) ---

export function trackProductView(params: {
  product_id: string;
  product_name: string;
  product_price: number;
  product_category: string;
}): void {
  pushEvent({ ...baseFields(), event: 'product_view', ...params });
}

export function trackAddToCart(params: {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}): void {
  pushEvent({ ...baseFields(), event: 'add_to_cart', ...params });
}

export function trackRemoveFromCart(params: {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}): void {
  pushEvent({ ...baseFields(), event: 'remove_from_cart', ...params });
}

export function trackBeginCheckout(params: { cart_total: number; item_count: number }): void {
  pushEvent({ ...baseFields(), event: 'begin_checkout', ...params });
}

export function trackPurchase(params: {
  order_id: string;
  order_total: number;
  item_count: number;
  products: string;
}): void {
  pushEvent({ ...baseFields(), event: 'purchase', ...params });
}

// --- Subscription demo tracking (Phase 6) ---

export function trackPlanSelect(params: {
  plan_id: string;
  plan_name: string;
  plan_price: number;
}): void {
  pushEvent({ ...baseFields(), event: 'plan_select', ...params });
}

export function trackTrialSignup(params: {
  plan_id: string;
  plan_name: string;
  plan_price: number;
}): void {
  pushEvent({ ...baseFields(), event: 'trial_signup', ...params });
}

// --- Lead gen demo tracking (Phase 6) ---

export function trackFormComplete(params: {
  form_name: string;
  partnership_type: string;
  budget_range: string;
  company_name: string;
}): void {
  pushEvent({ ...baseFields(), event: 'form_complete', ...params });
}

export function trackLeadQualify(params: {
  lead_id: string;
  qualification_tier: string;
  partnership_type: string;
  budget_range: string;
}): void {
  pushEvent({ ...baseFields(), event: 'lead_qualify', ...params });
}

// --- Phase 9E, nav & Session State analytics ---

export function trackCoverageMilestone(threshold: CoverageMilestoneEvent['threshold']): void {
  pushEvent({ ...baseFields(), event: 'coverage_milestone', threshold });
}

export function trackPortalClick(destination: PortalClickEvent['destination']): void {
  pushEvent({ ...baseFields(), event: 'portal_click', destination });
}

export function trackOverviewTabView(source: 'default_landing' | 'manual_select'): void {
  pushEvent({ ...baseFields(), event: 'overview_tab_view', source });
}

export function trackTimelineTabView(source: 'default_landing' | 'manual_select'): void {
  pushEvent({ ...baseFields(), event: 'timeline_tab_view', source });
}

export function trackConsentTabView(source: 'default_landing' | 'manual_select'): void {
  pushEvent({ ...baseFields(), event: 'consent_tab_view', source });
}

export function trackNavHintShown(): void {
  pushEvent({ ...baseFields(), event: 'nav_hint_shown' });
}

export function trackNavHintDismissed(mode: NavHintDismissedEvent['dismissal_mode']): void {
  pushEvent({ ...baseFields(), event: 'nav_hint_dismissed', dismissal_mode: mode });
}

export function trackSessionPulseHover(): void {
  pushEvent({ ...baseFields(), event: 'session_pulse_hover' });
}

// --- Phase 10 D1, Core Web Vitals telemetry ---

export function trackWebVital(params: {
  metric_name: WebVitalEvent['metric_name'];
  metric_value: number;
  metric_rating: WebVitalEvent['metric_rating'];
  metric_id: string;
  navigation_type: string;
}): void {
  pushEvent({ ...baseFields(), event: 'web_vital', ...params });
}

// --- Phase 10d D3, page-level engagement telemetry ---

export function trackPageEngagement(params: {
  engagement_seconds: PageEngagementEvent['engagement_seconds'];
  max_scroll_pct: number;
}): void {
  pushEvent({ ...baseFields(), event: 'page_engagement', ...params });
}

// --- Claudish translator (feat/claudish) ---

export function trackClaudishTranslate(params: {
  direction: ClaudishTranslateEvent['direction'];
  source_mode: ClaudishTranslateEvent['source_mode'];
  detected_language: ClaudishTranslateEvent['detected_language'];
  detector_source: ClaudishTranslateEvent['detector_source'];
  outcome: ClaudishTranslateEvent['outcome'];
  input_chars: number;
  input_em_dashes: number;
  output_chars: number;
  ttft_ms: number;
  duration_ms: number;
  cache: ClaudishTranslateEvent['cache'];
}): void {
  pushEvent({ ...baseFields(), event: 'claudish_translate', ...params });
}

export function trackClaudishDetected(params: {
  detected_language: ClaudishDetectedEvent['detected_language'];
  detector_source: ClaudishDetectedEvent['detector_source'];
  input_chars: number;
}): void {
  pushEvent({ ...baseFields(), event: 'claudish_detected', ...params });
}

export function trackClaudishShare(params: {
  share_action: ClaudishShareEvent['share_action'];
  direction: ClaudishShareEvent['direction'];
  output_chars: number;
  share_truncated: boolean;
  share_url_chars: number;
  from_sample: boolean;
}): void {
  pushEvent({ ...baseFields(), event: 'claudish_share', ...params });
}

export function trackClaudishRate(params: {
  rating: ClaudishRateEvent['rating'];
  direction: ClaudishRateEvent['direction'];
  output_chars: number;
  from_sample: boolean;
}): void {
  pushEvent({ ...baseFields(), event: 'claudish_rate', ...params });
}

export function trackClaudishSamplePick(params: {
  sample_index: number;
  direction: ClaudishSamplePickEvent['direction'];
}): void {
  pushEvent({ ...baseFields(), event: 'claudish_sample_pick', ...params });
}
