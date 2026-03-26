/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

const mockTrackClickCta = trackClickCta as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CtaLink', () => {
  // Lazy import so mock is in place
  function getCtaLink() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/components/cta-link').CtaLink;
  }

  it('renders as a link with correct href', () => {
    const CtaLink = getCtaLink();
    render(
      <CtaLink href="/services" ctaLocation="test">
        Click me
      </CtaLink>,
    );
    expect(screen.getByRole('link', { name: 'Click me' })).toHaveAttribute('href', '/services');
  });

  it('fires trackClickCta with string children text', async () => {
    const CtaLink = getCtaLink();
    const user = userEvent.setup();
    render(
      <CtaLink href="/services" ctaLocation="hero">
        See how it works
      </CtaLink>,
    );
    await user.click(screen.getByRole('link'));
    expect(mockTrackClickCta).toHaveBeenCalledWith('See how it works', 'hero');
  });

  it('extracts text from JSX children for tracking', async () => {
    const CtaLink = getCtaLink();
    const user = userEvent.setup();
    render(
      <CtaLink href="/services" ctaLocation="proof">
        <span>Explore</span> the demos
      </CtaLink>,
    );
    await user.click(screen.getByRole('link'));
    expect(mockTrackClickCta).toHaveBeenCalledWith('Explore the demos', 'proof');
  });

  it('renders disabled state as span with aria-disabled', () => {
    const CtaLink = getCtaLink();
    render(
      <CtaLink href="/demo" ctaLocation="hero" disabled>
        Coming soon
      </CtaLink>,
    );
    const span = screen.getByText('Coming soon');
    expect(span.tagName).toBe('SPAN');
    expect(span).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not render a link when disabled', () => {
    const CtaLink = getCtaLink();
    render(
      <CtaLink href="/demo" ctaLocation="hero" disabled>
        Coming soon
      </CtaLink>,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});
