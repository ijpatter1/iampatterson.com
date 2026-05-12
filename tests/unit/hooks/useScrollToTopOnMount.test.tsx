/**
 * @jest-environment jsdom
 *
 * UAT r3 B11: the shared scroll-to-top hook is the load-bearing fix
 * for the "page lands halfway down" symptom on cross-page navigation
 * from a mid-page CTA. Pin the contract here so all consumers
 * (ListingView, ProductDetail, CartView, CheckoutForm,
 * OrderConfirmation, EcommerceDashboard) share one canonical
 * behaviour; if the hook regresses to `behavior: 'auto'` or drops
 * the snap entirely, every surface that depends on it fails red
 * at the hook test level rather than at six unrelated route tests.
 */
import { renderHook } from '@testing-library/react';

import { useScrollToTopOnMount } from '@/hooks/useScrollToTopOnMount';

describe('useScrollToTopOnMount', () => {
  it('calls window.scrollTo({ top: 0, left: 0, behavior: "instant" }) once on mount', () => {
    const scrollSpy = jest.fn();
    const original = window.scrollTo;
    (window as { scrollTo: unknown }).scrollTo = scrollSpy;
    try {
      renderHook(() => useScrollToTopOnMount());
      expect(scrollSpy).toHaveBeenCalledTimes(1);
      expect(scrollSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    } finally {
      (window as { scrollTo: unknown }).scrollTo = original;
    }
  });

  it('does not fire again on re-render (single mount-time call)', () => {
    const scrollSpy = jest.fn();
    const original = window.scrollTo;
    (window as { scrollTo: unknown }).scrollTo = scrollSpy;
    try {
      const { rerender } = renderHook(() => useScrollToTopOnMount());
      expect(scrollSpy).toHaveBeenCalledTimes(1);
      rerender();
      rerender();
      expect(scrollSpy).toHaveBeenCalledTimes(1);
    } finally {
      (window as { scrollTo: unknown }).scrollTo = original;
    }
  });
});
