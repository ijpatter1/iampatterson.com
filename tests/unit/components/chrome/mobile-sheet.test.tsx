/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MobileSheet } from '@/components/chrome/mobile-sheet';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

jest.mock('@/hooks/useDataLayerEvents', () => ({
  useDataLayerEvents: () => ({ events: [] }),
}));

jest.mock('@/lib/events/session', () => ({
  getSessionId: () => 'ses1234567',
}));

import { trackClickNav } from '@/lib/events/track';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MobileSheet', () => {
  it('renders hidden when closed (pointer events off, aria-hidden)', () => {
    render(<MobileSheet open={false} onClose={jest.fn()} currentPath="/" />);
    const sheet = screen.getByTestId('mobile-sheet');
    expect(sheet).toHaveAttribute('aria-hidden', 'true');
    expect(sheet.className).toContain('pointer-events-none');
  });

  it('renders open with all five numbered nav items', () => {
    render(<MobileSheet open={true} onClose={jest.fn()} currentPath="/" />);
    const sheet = screen.getByTestId('mobile-sheet');
    expect(sheet).toHaveAttribute('aria-hidden', 'false');

    const nav = within(sheet).getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /01.*home/i })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /02.*services/i })).toHaveAttribute(
      'href',
      '/services',
    );
    expect(within(nav).getByRole('link', { name: /03.*demos/i })).toHaveAttribute(
      'href',
      '/#demos',
    );
    expect(within(nav).getByRole('link', { name: /04.*about/i })).toHaveAttribute('href', '/about');
    expect(within(nav).getByRole('link', { name: /05.*contact/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('fires onClose and trackClickNav when a link is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<MobileSheet open={true} onClose={onClose} currentPath="/" />);

    await user.click(screen.getByRole('link', { name: /services/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trackClickNav).toHaveBeenCalledWith('Services', '/services');
  });

  it('fires onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<MobileSheet open={true} onClose={onClose} currentPath="/" />);

    await user.click(screen.getByRole('button', { name: /close menu/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
