import { render, screen } from '@testing-library/react';

import ServicesPage from '@/app/services/page';

describe('ServicesPage', () => {
  it('renders the page heading', () => {
    render(<ServicesPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/four tiers/i);
  });

  it('renders all four tier headings', () => {
    render(<ServicesPage />);
    expect(screen.getByText(/tier 1: measurement foundation/i)).toBeInTheDocument();
    expect(screen.getByText(/tier 2: data infrastructure/i)).toBeInTheDocument();
    expect(screen.getByText(/tier 3: business intelligence/i)).toBeInTheDocument();
    expect(screen.getByText(/tier 4: attribution & advanced analytics/i)).toBeInTheDocument();
  });

  it('renders tier subheadings', () => {
    render(<ServicesPage />);
    expect(screen.getByText(/get the data right at the source/i)).toBeInTheDocument();
    expect(screen.getByText(/turn raw events into a source of truth/i)).toBeInTheDocument();
    expect(screen.getByText(/answers, not dashboards/i)).toBeInTheDocument();
    expect(screen.getByText(/finally answering/i)).toBeInTheDocument();
  });

  it('renders tier outcome summaries', () => {
    render(<ServicesPage />);
    expect(screen.getByText(/what you get at the end of tier 1/i)).toBeInTheDocument();
    expect(screen.getByText(/what you get at the end of tier 2/i)).toBeInTheDocument();
    expect(screen.getByText(/what you get at the end of tier 3/i)).toBeInTheDocument();
    expect(screen.getByText(/what you get at the end of tier 4/i)).toBeInTheDocument();
  });
});
