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
// CookiebotOnAccept or CookiebotOnDecline, with `hasResponse === true`.

type CookiebotStub = {
  hasResponse?: boolean;
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

    setCookiebot({ hasResponse: true, consent: { statistics: true, marketing: false } });
    fire('CookiebotOnLoad');
    fire('CookiebotOnAccept');
    act(() => trackPageView('/'));
    expect(readAid()).toBe('stored-id');
    expect(lastEvent().anonymous_id).toBe('stored-id');
  });

  it('does nothing to the cookie while Cookiebot has not resolved', () => {
    document.cookie = '_iap_aid=stored-id; Path=/';
    setCookiebot({ hasResponse: false, consent: { statistics: false } });
    render(<CookiebotConsentListener />);
    expect(readAid()).toBe('stored-id');
  });

  it('expires a leftover on mount when Cookiebot already has a resolved decline', () => {
    document.cookie = '_iap_aid=left-over; Path=/';
    setCookiebot({ hasResponse: true, consent: { statistics: false, marketing: true } });
    render(<CookiebotConsentListener />);
    expect(readAid()).toBeNull();
  });

  // CookiebotOnLoad without an answer only cleans up the cookie. It records
  // no consent and sends no gtag update: the consent state stays whatever
  // Cookiebot reported, so an implied-consent region is never forced to
  // denied.
  describe('CookiebotOnLoad for a visitor who has never chosen', () => {
    function captureGtag(): unknown[][] {
      const calls: unknown[][] = [];
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
        calls.push(args);
      };
      return calls;
    }

    it('expires a leftover without touching consent or gtag', () => {
      document.cookie = '_iap_aid=left-over; Path=/';
      setCookiebot({ consent: { statistics: false, marketing: true, preferences: true } });
      render(<CookiebotConsentListener />);
      expect(readAid()).toBe('left-over');
      const before = getCurrentConsent();
      const gtagCalls = captureGtag();

      setCookiebot({
        hasResponse: false,
        consent: { statistics: false, marketing: true, preferences: true },
      });
      fire('CookiebotOnLoad');
      expect(readAid()).toBeNull();
      expect(gtagCalls).toEqual([]);
      expect(getCurrentConsent()).toEqual(before);
      act(() => trackPageView('/'));
      expect(lastEvent().anonymous_id).toBe('');
    });

    it('keeps the cookie where Cookiebot reports statistics granted without an answer', () => {
      document.cookie = '_iap_aid=implied-region-id; Path=/';
      setCookiebot(UNRESOLVED);
      render(<CookiebotConsentListener />);
      const before = getCurrentConsent();
      const gtagCalls = captureGtag();

      setCookiebot({ hasResponse: false, consent: { statistics: true, marketing: false } });
      fire('CookiebotOnLoad');
      expect(readAid()).toBe('implied-region-id');
      expect(gtagCalls).toEqual([]);
      expect(getCurrentConsent()).toEqual(before);
    });
  });

  it('leaves the cookie to the accept or decline event when CookiebotOnLoad has an answer', () => {
    document.cookie = '_iap_aid=stored-id; Path=/';
    setCookiebot(UNRESOLVED);
    render(<CookiebotConsentListener />);
    setCookiebot({ hasResponse: true, consent: { statistics: false } });
    fire('CookiebotOnLoad');
    expect(readAid()).toBe('stored-id');
    fire('CookiebotOnDecline');
    expect(readAid()).toBeNull();
  });
});
