/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FinalCta } from '@/components/home/final-cta';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

function Probe() {
  const { isOpen } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? 'open' : 'closed'}</span>;
}

function renderCta() {
  return render(
    <OverlayProvider>
      <FinalCta />
      <Probe />
    </OverlayProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FinalCta', () => {
  it('renders the contact eyebrow with the email address', () => {
    renderCta();
    const eyebrow = screen.getByRole('link', { name: /contact — ian@iampatterson\.com/i });
    expect(eyebrow).toHaveAttribute('href', 'mailto:ian@iampatterson.com');
  });

  it('renders the three-line headline with italic "Then hire me."', () => {
    renderCta();
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.textContent).toMatch(/Watch it[\s\S]*run first[\s\S]*Then hire me/);
    const em = screen.getByText(/^Then hire me\.$/);
    expect(em.tagName).toBe('EM');
    expect(em.className).toContain('accent-current');
  });

  it('renders the sub-headline copy', () => {
    renderCta();
    expect(screen.getByText(/Every event your session fires, streaming live/i)).toBeInTheDocument();
  });

  it('primary CTA opens the overlay and fires click_cta', async () => {
    const user = userEvent.setup();
    renderCta();
    const cta = screen.getByRole('button', { name: /look under the hood/i });
    await user.click(cta);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(trackClickCta).toHaveBeenCalledWith('Look under the hood', 'final_cta');
  });

  it('ghost CTA links to /contact', () => {
    renderCta();
    const contact = screen.getByRole('link', { name: /start a conversation/i });
    expect(contact).toHaveAttribute('href', '/contact');
  });
});
