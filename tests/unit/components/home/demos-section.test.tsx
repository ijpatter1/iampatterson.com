/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DemosSection } from '@/components/home/demos-section';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DemosSection', () => {
  it('renders the editorial heading with italic "stack" emphasis', () => {
    render(<DemosSection />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.textContent).toMatch(/Three business models[\s\S]*Same[\s\S]*stack/);
    const stack = screen.getByText(/^stack$/);
    expect(stack.tagName).toBe('EM');
    expect(stack.className).toContain('accent-current');
  });

  it('renders the eyebrow description', () => {
    render(<DemosSection />);
    expect(
      screen.getByText(/each demo below is a fully functional front-end/i),
    ).toBeInTheDocument();
  });

  it('renders three demo cards linked to the correct routes', () => {
    render(<DemosSection />);
    expect(screen.getByRole('link', { name: /the tuna shop/i })).toHaveAttribute(
      'href',
      '/demo/ecommerce',
    );
    expect(screen.getByRole('link', { name: /tuna subscription/i })).toHaveAttribute(
      'href',
      '/demo/subscription',
    );
    expect(screen.getByRole('link', { name: /tuna partnerships/i })).toHaveAttribute(
      'href',
      '/demo/leadgen',
    );
  });

  it('surfaces each demo type label', () => {
    render(<DemosSection />);
    expect(screen.getByText('E-Commerce')).toBeInTheDocument();
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Lead Gen')).toBeInTheDocument();
  });

  it('uses an anchor id of "demos" to match the /#demos hash target', () => {
    render(<DemosSection />);
    expect(screen.getByTestId('demos-section').id).toBe('demos');
  });

  it('fires click_cta when a demo card is clicked', async () => {
    const user = userEvent.setup();
    render(<DemosSection />);
    await user.click(screen.getByRole('link', { name: /the tuna shop/i }));
    expect(trackClickCta).toHaveBeenCalledWith('Explore The Tuna Shop', 'demo_card_ecommerce');
  });

  it('renders swipe-hint bars with the first bar active by default', () => {
    render(<DemosSection />);
    expect(screen.getByTestId('swipe-bar-0').dataset.on).toBe('true');
    expect(screen.getByTestId('swipe-bar-1').dataset.on).toBe('false');
    expect(screen.getByTestId('swipe-bar-2').dataset.on).toBe('false');
  });

  it('updates the active swipe bar as the track scrolls', () => {
    render(<DemosSection />);
    const track = screen.getByTestId('demos-track');
    // Simulate scrolling to the second card — jsdom doesn't run scroll,
    // so we manually set the properties the component reads and fire scroll.
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(track, 'scrollLeft', { configurable: true, value: 100 * 0.82 });
    fireEvent.scroll(track);
    expect(screen.getByTestId('swipe-bar-1').dataset.on).toBe('true');
  });
});
