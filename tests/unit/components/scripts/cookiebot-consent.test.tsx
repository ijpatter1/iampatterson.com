/**
 * @jest-environment jsdom
 */
import { render, act } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackConsentUpdate: jest.fn(),
  initConsentState: jest.fn(),
}));

import { initConsentState, trackConsentUpdate } from '@/lib/events/track';

const mockTrackConsentUpdate = trackConsentUpdate as jest.Mock;
const mockInitConsentState = initConsentState as jest.Mock;

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

  it('fires trackConsentUpdate when CookiebotOnAccept is dispatched', () => {
    const CookiebotConsentListener = getComponent();
    // Simulate Cookiebot global
    (window as Record<string, unknown>).Cookiebot = {
      consent: { statistics: true, marketing: false, preferences: true },
    };
    render(<CookiebotConsentListener />);
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnAccept'));
    });
    expect(mockTrackConsentUpdate).toHaveBeenCalledWith(true, false, true);
  });

  it('fires trackConsentUpdate when CookiebotOnDecline is dispatched', () => {
    const CookiebotConsentListener = getComponent();
    (window as Record<string, unknown>).Cookiebot = {
      consent: { statistics: false, marketing: false, preferences: false },
    };
    render(<CookiebotConsentListener />);
    act(() => {
      window.dispatchEvent(new Event('CookiebotOnDecline'));
    });
    expect(mockTrackConsentUpdate).toHaveBeenCalledWith(false, false, false);
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

  it('treats a missing hasResponse on mount as unresolved', () => {
    const CookiebotConsentListener = getComponent();
    (window as Record<string, unknown>).Cookiebot = { consent: {} };
    render(<CookiebotConsentListener />);
    expect(mockInitConsentState).toHaveBeenCalledWith(undefined, undefined, undefined, false);
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
