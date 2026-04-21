/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { ProofSection } from '@/components/home/proof-section';

describe('ProofSection', () => {
  it('renders the Evidence kicker', () => {
    render(<ProofSection />);
    expect(screen.getByText(/Evidence · What the infrastructure has done/i)).toBeInTheDocument();
  });

  it('renders the editorial headline with italic "same one" emphasis', () => {
    render(<ProofSection />);
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.textContent).toMatch(/stack running[\s\S]*same one[\s\S]*deploy/);
    const em = screen.getByText(/^same one$/);
    expect(em.tagName).toBe('EM');
    expect(em.className).toContain('accent-current');
  });

  it('renders the intro paragraph about the brand and calendars', () => {
    render(<ProofSection />);
    expect(screen.getByText(/2\.5M-follower pet brand/i)).toBeInTheDocument();
    expect(screen.getByText(/isn.t a case study/i)).toBeInTheDocument();
  });

  it('renders three proof cards', () => {
    render(<ProofSection />);
    expect(screen.getByTestId('proof-card-audience')).toBeInTheDocument();
    expect(screen.getByTestId('proof-card-revenue-proof')).toBeInTheDocument();
    expect(screen.getByTestId('proof-card-live-events')).toBeInTheDocument();
  });

  it('shows the three headline metrics', () => {
    render(<ProofSection />);
    // 2.5M, audience
    const audience = screen.getByTestId('proof-card-audience');
    expect(audience.textContent).toContain('2.5');
    expect(audience.textContent).toContain('M');
    // $45K, revenue proof
    const revenue = screen.getByTestId('proof-card-revenue-proof');
    expect(revenue.textContent).toContain('$45');
    expect(revenue.textContent).toContain('K');
    // 24/7, live events
    const live = screen.getByTestId('proof-card-live-events');
    expect(live.textContent).toContain('24/');
    expect(live.textContent).toContain('7');
  });

  it('shows context copy for each metric', () => {
    render(<ProofSection />);
    expect(screen.getByText(/Chiweenie with an overbite/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-generated calendar program/i)).toBeInTheDocument();
    expect(screen.getByText(/open the overlay to watch yours/i)).toBeInTheDocument();
  });
});
