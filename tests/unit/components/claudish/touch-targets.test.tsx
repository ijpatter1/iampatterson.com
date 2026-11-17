/**
 * @jest-environment jsdom
 *
 * Claudish translator — touch targets and focus (21.3, the approved
 * mockup's control sizes).
 *
 * The page now opens filled, so every control is live on first paint:
 * clear, swap, copy, rate, share, the language tabs and the sample
 * cards. Each must be at least 44px in both directions it can be tapped
 * (WCAG 2.5.5's target size, and the mockup's 44px), and each must show
 * where keyboard focus is, including the text box, which used to set
 * outline-none with nothing in its place. jsdom has no layout, so this
 * pins the utility classes that produce the size and the focus ring.
 */
import { render, screen, within } from '@testing-library/react';

jest.mock('@/lib/claudish/client', () => ({
  translateEndpoint: (
    jest.requireActual('@/lib/claudish/client') as { translateEndpoint: (u: string) => string }
  ).translateEndpoint,
  streamTranslation: jest.fn(),
}));
jest.mock('@/lib/events/track', () => ({
  trackClaudishTranslate: jest.fn(),
  trackClaudishDetected: jest.fn(),
  trackClaudishShare: jest.fn(),
  trackClaudishRate: jest.fn(),
}));
jest.mock('@/hooks/useScrollToTopOnMount', () => ({ useScrollToTopOnMount: jest.fn() }));

import { ClaudishApp } from '@/components/claudish/claudish-app';

const FOCUS_RING = 'focus-visible:ring-2';

describe('Claudish controls', () => {
  it('sizes every button and tab in the translator to at least 44px tall', () => {
    render(<ClaudishApp />);
    const main = screen.getByRole('main');
    const controls = [...within(main).getAllByRole('button'), ...within(main).getAllByRole('tab')];
    // clear, swap, copy, rate, share, 3 sample cards, 5 tabs.
    expect(controls.length).toBeGreaterThanOrEqual(13);
    for (const control of controls) {
      expect(control.className).toContain('min-h-[44px]');
    }
  });

  it('makes the round icon buttons 44px wide as well as tall', () => {
    render(<ClaudishApp />);
    for (const name of [
      'Clear source text',
      'Swap languages',
      'Copy translation',
      'Rate translation',
      'Share translation',
    ]) {
      expect(screen.getByRole('button', { name }).className).toContain('min-w-[44px]');
    }
  });

  it('shows a visible focus ring on the text box and on every control', () => {
    render(<ClaudishApp />);
    const main = screen.getByRole('main');
    const box = screen.getByRole('textbox');
    expect(box.className).toContain(FOCUS_RING);
    for (const control of [
      ...within(main).getAllByRole('button'),
      ...within(main).getAllByRole('tab'),
    ]) {
      expect(control.className).toContain(FOCUS_RING);
    }
  });
});
