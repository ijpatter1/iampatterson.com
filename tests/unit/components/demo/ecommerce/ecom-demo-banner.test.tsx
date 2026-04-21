/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

import { EcomDemoBanner } from '@/components/demo/ecommerce/ecom-demo-banner';

describe('EcomDemoBanner (UAT r2 item 7)', () => {
  it('renders the "this is a demo · nothing ships from here" reminder', () => {
    const { container } = render(<EcomDemoBanner />);
    const banner = container.querySelector('[data-ecom-demo-banner]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toMatch(/this is a demo/i);
    expect(banner?.textContent).toMatch(/nothing ships from here/i);
  });

  it('uses the terminal amber-on-near-black palette', () => {
    const { container } = render(<EcomDemoBanner />);
    const banner = container.querySelector('[data-ecom-demo-banner]') as HTMLElement;
    expect(banner.className).toMatch(/#0D0B09/i);
    expect(banner.className).toMatch(/#F3C769/i);
  });

  it("carries a live-indicator pulse dot (aria-hidden so it doesn't read as decoration)", () => {
    const { container } = render(<EcomDemoBanner />);
    const dot = container.querySelector('[data-ecom-demo-banner] span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot?.className).toMatch(/animate-pulse/);
  });

  // Tech-evaluator Minor #5 — the component spreads extra HTMLAttributes
  // via `{...props}` so callers can override the className, add
  // data-testid, etc. Pin the extensibility so a refactor that drops
  // the spread doesn't silently break existing callers.
  it('forwards arbitrary HTMLDivElement props via spread', () => {
    const { container } = render(<EcomDemoBanner data-testid="forwarded" aria-live="polite" />);
    const banner = container.querySelector('[data-ecom-demo-banner]') as HTMLElement;
    expect(banner.getAttribute('data-testid')).toBe('forwarded');
    expect(banner.getAttribute('aria-live')).toBe('polite');
  });
});
