/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import ServicesPage from '@/app/services/page';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
      ...rest
    }: {
      children: React.ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => {
      const skip = new Set([
        'initial',
        'animate',
        'exit',
        'transition',
        'variants',
        'whileInView',
        'viewport',
      ]);
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (!skip.has(k)) filtered[k] = v;
      }
      return (
        <div className={className} {...filtered}>
          {children}
        </div>
      );
    },
  },
  useReducedMotion: () => false,
}));

describe('ServicesPage', () => {
  it('renders the positioning heading', () => {
    render(<ServicesPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /end-to-end measurement infrastructure/i,
    );
  });

  it('renders the engagement structure heading', () => {
    render(<ServicesPage />);
    expect(screen.getByText(/four tiers/i)).toBeInTheDocument();
  });

  it('renders all four tier headings', () => {
    render(<ServicesPage />);
    // Titles appear in both positioning overview and detailed tier sections
    expect(screen.getAllByText('Measurement Foundation').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Data Infrastructure').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Business Intelligence').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Attribution & Advanced Analytics').length).toBeGreaterThanOrEqual(
      2,
    );
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

  it('renders tier numbers', () => {
    render(<ServicesPage />);
    // Numbers appear in both the positioning cards and the tier sections
    expect(screen.getAllByText('01').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('02').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('03').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('04').length).toBeGreaterThanOrEqual(1);
  });
});
