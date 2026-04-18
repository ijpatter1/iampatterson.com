/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ServicesTeaser } from '@/components/home/services-teaser';

jest.mock('@/lib/events/track', () => ({
  trackClickNav: jest.fn(),
}));

import { trackClickNav } from '@/lib/events/track';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ServicesTeaser', () => {
  it('renders the "What I build" eyebrow', () => {
    render(<ServicesTeaser />);
    expect(screen.getByText(/what I build · four tiers/i)).toBeInTheDocument();
  });

  it('renders the editorial headline with italic "Not" emphasis', () => {
    render(<ServicesTeaser />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.textContent).toMatch(
      /End-to-end measurement infrastructure.*Not.*tag implementation/s,
    );
    const em = screen.getByText(/^Not$/);
    expect(em.tagName).toBe('EM');
  });

  it('renders all four tier rows linking to /services', () => {
    render(<ServicesTeaser />);
    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(4);
    rows.forEach((r) => expect(r).toHaveAttribute('href', '/services'));
  });

  it('shows each tier number and title', () => {
    render(<ServicesTeaser />);
    expect(screen.getByText(/TIER 01/i)).toBeInTheDocument();
    expect(screen.getByText(/TIER 04/i)).toBeInTheDocument();
    expect(screen.getByText('Measurement Foundation')).toBeInTheDocument();
    expect(screen.getByText('Business Intelligence')).toBeInTheDocument();
  });

  it('fires trackClickNav when a tier row is clicked', async () => {
    const user = userEvent.setup();
    render(<ServicesTeaser />);
    await user.click(screen.getAllByRole('link')[0]);
    expect(trackClickNav).toHaveBeenCalledWith('Tier 01 Measurement Foundation', '/services');
  });
});
