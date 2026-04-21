/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { FooterSlot } from '@/components/footer-slot';
import { OverlayProvider } from '@/components/overlay/overlay-context';

const mockPathname = jest.fn<string, []>();
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
  trackClickCta: jest.fn(),
}));

function renderSlot() {
  return render(
    <OverlayProvider>
      <FooterSlot />
    </OverlayProvider>,
  );
}

describe('FooterSlot, ecommerce suppression', () => {
  afterEach(() => {
    mockPathname.mockReset();
  });

  it('renders the site Footer on the homepage', () => {
    mockPathname.mockReturnValue('/');
    renderSlot();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the site Footer on /services', () => {
    mockPathname.mockReturnValue('/services');
    renderSlot();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders nothing on /demo/ecommerce', () => {
    mockPathname.mockReturnValue('/demo/ecommerce');
    renderSlot();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('renders nothing on nested ecommerce routes (cart, checkout, confirmation, product detail)', () => {
    for (const path of [
      '/demo/ecommerce/cart',
      '/demo/ecommerce/checkout',
      '/demo/ecommerce/confirmation',
      '/demo/ecommerce/tuna-plush-classic',
    ]) {
      mockPathname.mockReturnValue(path);
      const { unmount } = renderSlot();
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('still renders the site Footer on non-ecommerce demo routes (future-proof)', () => {
    mockPathname.mockReturnValue('/demo/subscription');
    renderSlot();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
