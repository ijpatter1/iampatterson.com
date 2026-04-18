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

  it('renders three showcase section headings: consent, events, and pipeline', () => {
    render(<HomepageUnderside />);
    // Scoped to mono h3 section labels so the supporting paragraph doesn't
    // collide with getByText.
    const headings = screen.getAllByRole('heading', { level: 3 });
    const labels = headings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringContaining('consent management'),
        expect.stringContaining('live event stream'),
        expect.stringContaining('pipeline architecture'),
      ]),
    );
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
