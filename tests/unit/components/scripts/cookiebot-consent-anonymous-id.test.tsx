/**
 * @jest-environment jsdom
 */
import { render, act } from '@testing-library/react';

import { CookiebotConsentListener } from '@/components/scripts/cookiebot-consent';
import { getCurrentConsent, initConsentState, trackPageView } from '@/lib/events/track';

// The real listener against the real track.ts. `_iap_aid` is a Statistics
// cookie (Ian, 2026-11-14), and production minted it for every visitor until
// then, so leftovers exist. The cookie is expired exactly when Cookiebot has a
// resolved answer without analytics consent, and never before Cookiebot has
// resolved: measured in production on 2026-11-14, a reload with a stored
// choice shows `window.Cookiebot` at ~15ms with no answer (`hasResponse` not
// true, statistics undefined), then at ~180ms CookiebotOnLoad together with
// CookiebotOnAccept or CookiebotOnDecline, with `hasResponse === true`. For a
// visitor who has never chosen, CookiebotOnLoad never fires: `hasResponse`
// goes from undefined to false at ~170-230ms, then CookiebotOnDialogInit
// fires, then CookiebotOnDialogDisplay (~430-700ms).

type CookiebotStub = {
  hasResponse?: boolean;
  changed?: boolean;
  consent?: { statistics?: boolean; marketing?: boolean; preferences?: boolean };
};

const setCookiebot = (cb: CookiebotStub | undefined) => {
  if (cb === undefined) delete (window as unknown as { Cookiebot?: unknown }).Cookiebot;
  else (window as unknown as { Cookiebot: CookiebotStub }).Cookiebot = cb;
};
const fire = (name: string) =>
  act(() => {
    window.dispatchEvent(new Event(name));
  });
const readAid = () =>
  document.cookie
    .split('; ')
    .find((c) => c.startsWith('_iap_aid='))
    ?.slice('_iap_aid='.length) ?? null;
const lastEvent = () => window.dataLayer[window.dataLayer.length - 1] as { anonymous_id: string };

// Cookiebot before it has resolved a returning visitor's stored choice.
const UNRESOLVED: CookiebotStub = { consent: {} };

beforeEach(() => {
  window.dataLayer = [];
  document.cookie = '_iap_aid=; Max-Age=0; Path=/';
  document.cookie = '_iap_sid=test-session; Path=/';
});
afterEach(() => {
  setCookiebot(undefined);
  delete (window as unknown as { gtag?: unknown }).gtag;
  initConsentState(false, false, false, false);
  document.cookie = '_iap_aid=; Max-Age=0; Path=/';
});

describe('CookiebotConsentListener and the _iap_aid leftover', () => {
  it('keeps the same ID across a reload for a visitor whose stored choice granted analytics', () => {
    document.cookie = '_iap_aid=stored-id; Path=/';
    setCookiebot(UNRESOLVED);
    render(<CookiebotConsentListener />);
    expect(readAid()).toBe('stored-id');

    setCookiebot({
      hasResponse: true,
      changed: false,
      consent: { statistics: true, marketing: false },
    });
    fire('CookiebotOnLoad');
    fire('CookiebotOnAccept');
    act(() => trackPageView('/'));
    expect(readAid()).toBe('stored-id');
    expect(lastEvent().anonymous_id).toBe('stored-id');
  });

  it('does nothing to the cookie while Cookiebot has not resolved (hasResponse undefined)', () => {
    document.cookie = '_iap_aid=stored-id; Path=/';
    setCookiebot({ consent: { statistics: false } });
    render(<CookiebotConsentListener />);
    expect(readAid()).toBe('stored-id');
  });

  it('expires a leftover on mount when Cookiebot already has a resolved decline', () => {
    document.cookie = '_iap_aid=left-over; Path=/';
    setCookiebot({ hasResponse: true, consent: { statistics: false, marketing: true } });
    render(<CookiebotConsentListener />);
    expect(readAid()).toBeNull();
  });

  // 15.8: with no answer (`hasResponse === false`), what Cookiebot reports is
  // recorded as it reports it and sent to Consent Mode. For a visitor who has
  // never chosen that is a decline, which expires a leftover; in an opt-out
  // region it is implied consent, which keeps (or mints) the ID.
  describe('a visitor who has never chosen (measured sequence, no CookiebotOnLoad)', () => {
    function captureGtag(): unknown[][] {
      const calls: unknown[][] = [];
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
        calls.push(args);
      };
      return calls;
    }
    const consentUpdates = (calls: unknown[][]) =>
      calls.filter((c) => c[0] === 'consent' && c[1] === 'update').map((c) => c[2]);
    const NEVER_CHOSEN: CookiebotStub = {
      hasResponse: false,
      consent: { statistics: false, marketing: false, preferences: false },
    };

    it('records the decline Cookiebot reports on CookiebotOnDialogInit and expires a leftover', () => {
      document.cookie = '_iap_aid=left-over; Path=/';
      setCookiebot(UNRESOLVED);
      render(<CookiebotConsentListener />);
      expect(readAid()).toBe('left-over');
      const gtagCalls = captureGtag();

      setCookiebot(NEVER_CHOSEN);
      fire('CookiebotOnDialogInit');
      expect(readAid()).toBeNull();
      expect(consentUpdates(gtagCalls)).toEqual([
        expect.objectContaining({ analytics_storage: 'denied', ad_storage: 'denied' }),
      ]);
      act(() => trackPageView('/'));
      expect(lastEvent().anonymous_id).toBe('');
    });

    it('expires a leftover on mount when hasResponse is already false', () => {
      document.cookie = '_iap_aid=left-over; Path=/';
      setCookiebot(NEVER_CHOSEN);
      render(<CookiebotConsentListener />);
      expect(readAid()).toBeNull();
    });

    it('records implied consent Cookiebot reports without an answer, and keeps the ID', () => {
      document.cookie = '_iap_aid=implied-region-id; Path=/';
      setCookiebot(UNRESOLVED);
      render(<CookiebotConsentListener />);
      const gtagCalls = captureGtag();

      setCookiebot({
        hasResponse: false,
        consent: { statistics: true, marketing: true, preferences: true },
      });
      fire('CookiebotOnDialogInit');
      expect(readAid()).toBe('implied-region-id');
      expect(getCurrentConsent()).toEqual({
        consent_analytics: true,
        consent_marketing: true,
        consent_preferences: true,
      });
      expect(consentUpdates(gtagCalls)).toEqual([
        expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'granted' }),
      ]);
    });

    it('keeps the cookie on mount where Cookiebot reports statistics granted without an answer', () => {
      document.cookie = '_iap_aid=implied-region-id; Path=/';
      setCookiebot({ hasResponse: false, consent: { statistics: true } });
      render(<CookiebotConsentListener />);
      expect(readAid()).toBe('implied-region-id');
    });
  });

  // Cookiebot replaying a stored decline (`changed` false) still expires the
  // cookie, now without a consent_update (15.8).
  it('leaves a stored decline to CookiebotOnDecline when CookiebotOnLoad has an answer', () => {
    document.cookie = '_iap_aid=stored-id; Path=/';
    setCookiebot(UNRESOLVED);
    render(<CookiebotConsentListener />);
    setCookiebot({ hasResponse: true, changed: false, consent: { statistics: false } });
    fire('CookiebotOnLoad');
    expect(readAid()).toBe('stored-id');
    fire('CookiebotOnDecline');
    expect(readAid()).toBeNull();
    expect(window.dataLayer.some((e) => (e as { event?: string }).event === 'consent_update')).toBe(
      false,
    );
  });
});
