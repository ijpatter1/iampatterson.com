/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AboutPage from '@/app/about/page';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

beforeEach(() => {
  jest.clearAllMocks();
});

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

  it('renders the closer section with headline and body copy', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { name: /want to work together/i })).toBeInTheDocument();
    expect(screen.getByText(/where the numbers stop making sense/i)).toBeInTheDocument();
  });

  it('closer CTA links to /contact and fires click_cta with about_closer location', async () => {
    const user = userEvent.setup();
    render(<AboutPage />);
    const cta = screen.getByRole('link', { name: /start a conversation/i });
    expect(cta).toHaveAttribute('href', '/contact');
    await user.click(cta);
    expect(trackClickCta).toHaveBeenCalledWith('Start a conversation', 'about_closer');
  });
});
