/**
 * @jest-environment jsdom
 */
import { render, act } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackConsentUpdate: jest.fn(),
}));

import { trackConsentUpdate } from '@/lib/events/track';

const mockTrackConsentUpdate = trackConsentUpdate as jest.Mock;

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
    removeSpy.mockRestore();
  });
});
