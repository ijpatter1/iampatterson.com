/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { HomepageUnderside } from '@/components/overlay/homepage-underside';

describe('HomepageUnderside', () => {
  it('renders the editorial tier-1 kicker and instrumented headline', () => {
    render(<HomepageUnderside />);
    expect(screen.getByText(/tier 1 · running under your session/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(
      /instrumented with the same foundation/i,
    );
  });

  it('renders three showcase sections: consent, events, and pipeline', () => {
    render(<HomepageUnderside />);
    expect(screen.getByText(/consent management/i)).toBeInTheDocument();
    expect(screen.getByText(/live event stream/i)).toBeInTheDocument();
    expect(screen.getByText(/pipeline architecture/i)).toBeInTheDocument();
  });

  it('explains what the consent banner controls', () => {
    render(<HomepageUnderside />);
    expect(screen.getByText(/cookiebot.*consent/i)).toBeInTheDocument();
  });

  it('shows the pipeline stages', () => {
    render(<HomepageUnderside />);
    expect(screen.getByText('Browser')).toBeInTheDocument();
    expect(screen.getByText('Server-Side GTM')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
  });
});
