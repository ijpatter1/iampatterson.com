/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import AboutPage from '@/app/about/page';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

describe('AboutPage', () => {
  it('renders the page heading', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/i'm ian patterson/i);
  });

  it('renders the biographical content', () => {
    render(<AboutPage />);
    expect(screen.getByText(/allied global marketing/i)).toBeInTheDocument();
  });

  it('renders the Tuna Melts My Heart reference', () => {
    render(<AboutPage />);
    expect(screen.getByText(/tuna melts my heart/i)).toBeInTheDocument();
  });

  it('renders the What I believe section', () => {
    render(<AboutPage />);
    expect(screen.getByText(/measurement infrastructure is not a project/i)).toBeInTheDocument();
    expect(screen.getByText(/ai should be infrastructure/i)).toBeInTheDocument();
    expect(screen.getByText(/you should own your data and your methodology/i)).toBeInTheDocument();
  });
});
