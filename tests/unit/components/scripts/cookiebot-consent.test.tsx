/**
 * @jest-environment jsdom
 */
import { render, act } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackConsentUpdate: jest.fn(),
  initConsentState: jest.fn(),
  applyStoredConsent: jest.fn(),
}));

import { applyStoredConsent, initConsentState, trackConsentUpdate } from '@/lib/events/track';

const mockTrackConsentUpdate = trackConsentUpdate as jest.Mock;
const mockInitConsentState = initConsentState as jest.Mock;
const mockApplyStoredConsent = applyStoredConsent as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CookiebotConsentListener', () => {
  function getComponent() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/components/scripts/cookiebot-consent').CookiebotConsentListener;
  }

  it('registers event listeners for Cookiebot callbacks on mount', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const CookiebotConsentListener = getComponent();
    render(<CookiebotConsentListener />);
    expect(addSpy).toHaveBeenCalledWith('CookiebotOnAccept', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('CookiebotOnDecline', expect.any(Function));
    // The never-chosen cleanup: CookiebotOnLoad never fires for that visitor.
    expect(addSpy).toHaveBeenCalledWith('CookiebotOnDialogInit', expect.any(Function));
    expect(addSpy).not.toHaveBeenCalledWith('CookiebotOnLoad', expect.any(Function));
    addSpy.mockRestore();
  });

  // `Cookiebot.changed` is true when the visitor has just submitted a choice
  // and false when Cookiebot replays a stored one on page load (measured on
  // localhost, 2026-11-15).
  it('fires trackConsentUpdate when the visitor accepts', () => {
    const CookiebotConsentListener = getComponent();
    (window as Record<string, unknown>).Cookiebot = {
      hasResponse: true,
      changed: true,
      consent: { statistics: true, marketing: false, preferences: true },
    };
    render(<CookiebotConsentListener />);
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnAccept'));
    });
    // `true`: a banner submission, which may send the blocked page_view again.
    expect(mockTrackConsentUpdate).toHaveBeenCalledWith(true, false, true, true);
  });

  it('fires trackConsentUpdate when the visitor declines', () => {
    const CookiebotConsentListener = getComponent();
    (window as Record<string, unknown>).Cookiebot = {
      hasResponse: true,
      changed: true,
      consent: { statistics: false, marketing: false, preferences: false },
    };
    render(<CookiebotConsentListener />);
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnDecline'));
    });
    expect(mockTrackConsentUpdate).toHaveBeenCalledWith(false, false, false, true);
  });

  // `hasResponse` says whether Cookiebot has resolved the visitor's answer.
  // It is read where `Cookiebot.consent` is read and passed through, so the
  // init path can tell a resolved decline from Cookiebot's unresolved default.
  it('passes Cookiebot.hasResponse through to initConsentState on mount', () => {
    const CookiebotConsentListener = getComponent();
    (window as Record<string, unknown>).Cookiebot = {
      hasResponse: true,
      consent: { statistics: false, marketing: true, preferences: false },
    };
    render(<CookiebotConsentListener />);
    expect(mockInitConsentState).toHaveBeenCalledWith(false, true, false, true);
  });

  // 15.8: on a reload Cookiebot exists at ~15ms with no answer. Its
  // unresolved defaults are not the visitor's choice; recording them would
  // send Google a denied update after the stored choice the inline script
  // sent ahead of GTM. The stored cookie is applied instead.
  it('records nothing from Cookiebot before it has resolved, and applies the stored choice', () => {
    const CookiebotConsentListener = getComponent();
    (window as unknown as Record<string, unknown>).Cookiebot = { consent: {} };
    render(<CookiebotConsentListener />);
    expect(mockInitConsentState).not.toHaveBeenCalled();
    expect(mockApplyStoredConsent).toHaveBeenCalledTimes(1);
  });

  // The returning visitor's path: Cookiebot replays the stored choice on page
  // load with CookiebotOnLoad and then CookiebotOnAccept or CookiebotOnDecline,
  // `hasResponse` true and `changed` false. That is no choice the visitor made
  // on this page, so it is recorded silently: no consent_update.
  it.each([
    ['CookiebotOnAccept', { statistics: true, marketing: true, preferences: false }],
    ['CookiebotOnDecline', { statistics: false, marketing: false, preferences: false }],
  ])('records a stored choice replayed on %s without a consent_update', (event, consent) => {
    const CookiebotConsentListener = getComponent();
    (window as unknown as Record<string, unknown>).Cookiebot = { consent: {} };
    render(<CookiebotConsentListener />);
    (window as unknown as Record<string, unknown>).Cookiebot = {
      hasResponse: true,
      changed: false,
      consent,
    };
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnLoad'));
      window.dispatchEvent(new Event(event));
    });
    expect(mockTrackConsentUpdate).not.toHaveBeenCalled();
    expect(mockInitConsentState).toHaveBeenCalledWith(
      consent.statistics,
      consent.marketing,
      consent.preferences,
      true,
    );
  });

  // A Cookiebot that does not report `changed` gets the pre-15.8 behavior:
  // the event is treated as the visitor's choice.
  it('treats an event without Cookiebot.changed as a choice', () => {
    const CookiebotConsentListener = getComponent();
    (window as unknown as Record<string, unknown>).Cookiebot = {
      hasResponse: true,
      consent: { statistics: true, marketing: false, preferences: false },
    };
    render(<CookiebotConsentListener />);
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnAccept'));
    });
    // Not known to be a submission, so no page_view is sent again.
    expect(mockTrackConsentUpdate).toHaveBeenCalledWith(true, false, false, false);
  });

  // 15.8: with no answer, Cookiebot's reported consent is authoritative over
  // the stored cookie (a rejected or renewed cookie, or implied consent).
  it.each([
    ['on mount', false],
    ['on CookiebotOnDialogInit', true],
  ])('records what Cookiebot reports when hasResponse is false, %s', (_label, later) => {
    const CookiebotConsentListener = getComponent();
    const reported = {
      hasResponse: false,
      consent: { statistics: true, marketing: false, preferences: true },
    };
    (window as unknown as Record<string, unknown>).Cookiebot = later ? { consent: {} } : reported;
    render(<CookiebotConsentListener />);
    if (later) {
      expect(mockInitConsentState).not.toHaveBeenCalled();
      (window as unknown as Record<string, unknown>).Cookiebot = reported;
      act(() => {
        window.dispatchEvent(new Event('CookiebotOnDialogInit'));
      });
    }
    expect(mockInitConsentState).toHaveBeenCalledWith(true, false, true, true);
  });

  it('records nothing on CookiebotOnDialogInit while hasResponse is undefined', () => {
    const CookiebotConsentListener = getComponent();
    (window as unknown as Record<string, unknown>).Cookiebot = { consent: { statistics: true } };
    render(<CookiebotConsentListener />);
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnDialogInit'));
    });
    expect(mockInitConsentState).not.toHaveBeenCalled();
  });

  it('does not fire when Cookiebot global is absent', () => {
    const CookiebotConsentListener = getComponent();
    delete (window as Record<string, unknown>).Cookiebot;
    render(<CookiebotConsentListener />);
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnAccept'));
    });
    expect(mockTrackConsentUpdate).not.toHaveBeenCalled();
  });

  it('does not fire when Cookiebot.consent is undefined', () => {
    const CookiebotConsentListener = getComponent();
    (window as Record<string, unknown>).Cookiebot = {};
    render(<CookiebotConsentListener />);
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnAccept'));
    });
    expect(mockTrackConsentUpdate).not.toHaveBeenCalled();
  });

  it('removes event listeners on unmount', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const CookiebotConsentListener = getComponent();
    const { unmount } = render(<CookiebotConsentListener />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('CookiebotOnAccept', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('CookiebotOnDecline', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('CookiebotOnDialogInit', expect.any(Function));
    removeSpy.mockRestore();
  });
});
