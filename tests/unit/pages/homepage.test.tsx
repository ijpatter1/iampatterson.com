/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import HomePage from '@/app/page';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

import { trackClickCta } from '@/lib/events/track';

const mockTrackClickCta = trackClickCta as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HomePage', () => {
  it('renders the hero heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Your marketing data is lying to you.',
    );
  });

  it('renders the hero subheading', () => {
    render(<HomePage />);
    expect(
      screen.getByText(/platform-reported attribution is self-grading homework/i),
    ).toBeInTheDocument();
  });

  it('renders the problem section heading', () => {
    render(<HomePage />);
    expect(screen.getByText(/the measurement gap is getting wider/i)).toBeInTheDocument();
  });

  it('renders the what I deliver section heading', () => {
    render(<HomePage />);
    expect(screen.getByText(/end-to-end measurement infrastructure/i)).toBeInTheDocument();
  });

  it('renders the four tier summary headings', () => {
    render(<HomePage />);
    const terms = screen.getAllByRole('term');
    const termTexts = terms.map((t) => t.textContent);
    expect(termTexts).toContain('Measurement Foundation');
    expect(termTexts).toContain('Data Infrastructure');
    expect(termTexts).toContain('Business Intelligence');
    expect(termTexts).toContain('Attribution & Advanced Analytics');
  });

  it('renders the proof section heading', () => {
    render(<HomePage />);
    expect(screen.getByText(/this site is the case study/i)).toBeInTheDocument();
  });

  it('renders the See how it works CTA as a link to /services', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: /see how it works/i })).toHaveAttribute(
      'href',
      '/services',
    );
  });

  it('renders disabled demo CTAs as spans, not links', () => {
    render(<HomePage />);
    const demoSpan = screen.getByText(/explore a live demo/i);
    expect(demoSpan.tagName).toBe('SPAN');
    expect(demoSpan).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders the Explore the full service offering CTA as a link', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('link', { name: /explore the full service offering/i }),
    ).toHaveAttribute('href', '/services');
  });

  it('renders CTA arrows matching CONTENT_GUIDE', () => {
    render(<HomePage />);
    expect(screen.getByText(/explore the full service offering →/i)).toBeInTheDocument();
    expect(screen.getByText(/explore the demos →/i)).toBeInTheDocument();
  });

  it('fires trackClickCta when a CTA link is clicked', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(screen.getByRole('link', { name: /see how it works/i }));
    expect(mockTrackClickCta).toHaveBeenCalledWith('See how it works', 'hero');
  });
});
