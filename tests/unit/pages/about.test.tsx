import { render, screen } from '@testing-library/react';

import AboutPage from '@/app/about/page';

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

  it('renders the What I Believe section', () => {
    render(<AboutPage />);
    expect(screen.getByText(/measurement infrastructure is not a project/i)).toBeInTheDocument();
    expect(screen.getByText(/ai should be infrastructure/i)).toBeInTheDocument();
    expect(screen.getByText(/you should own your data and your methodology/i)).toBeInTheDocument();
  });
});
