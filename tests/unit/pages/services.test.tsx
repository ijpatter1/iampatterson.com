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
  it('renders the page heading', () => {
    render(<ServicesPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/four tiers/i);
  });

  it('renders all four tier headings', () => {
    render(<ServicesPage />);
    expect(screen.getByText('Measurement Foundation')).toBeInTheDocument();
    expect(screen.getByText('Data Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Business Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Attribution & Advanced Analytics')).toBeInTheDocument();
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
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
  });
});
