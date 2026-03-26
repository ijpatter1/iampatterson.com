import { render, screen } from '@testing-library/react';

import HomePage from '@/app/page';

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

  it('renders CTA links', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: /see how it works/i })).toHaveAttribute(
      'href',
      '/services',
    );
  });
});
