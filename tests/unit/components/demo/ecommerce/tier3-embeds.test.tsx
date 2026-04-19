/**
 * @jest-environment jsdom
 *
 * Phase 9B deliverable 6b — Tier 3 inline Metabase embeds on the
 * ecommerce confirmation page.
 */
import { render, screen } from '@testing-library/react';

import { Tier3Embeds } from '@/components/demo/ecommerce/tier3-embeds';

const URLS = {
  dailyRevenue: 'https://bi.iampatterson.com/embed/question/jwt-daily#bordered=true&titled=true',
  funnel: 'https://bi.iampatterson.com/embed/question/jwt-funnel#bordered=true&titled=true',
  aov: 'https://bi.iampatterson.com/embed/question/jwt-aov#bordered=true&titled=true',
};

describe('Tier3Embeds with live URLs', () => {
  it('renders three iframes in the narrative order: daily revenue → funnel → AOV', () => {
    const { container } = render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(3);
    expect(iframes[0].getAttribute('src')).toBe(URLS.dailyRevenue);
    expect(iframes[1].getAttribute('src')).toBe(URLS.funnel);
    expect(iframes[2].getAttribute('src')).toBe(URLS.aov);
  });

  it('sets descriptive titles on each iframe for assistive tech', () => {
    render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    expect(screen.getByTitle(/Daily revenue/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Funnel conversion/i)).toBeInTheDocument();
    expect(screen.getByTitle(/AOV trend/i)).toBeInTheDocument();
  });

  it('lazy-loads iframes so they do not block the confirmation paint', () => {
    const { container } = render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    container.querySelectorAll('iframe').forEach((frame) => {
      expect(frame.getAttribute('loading')).toBe('lazy');
    });
  });

  it('sets referrerPolicy=no-referrer so Metabase logs do not capture the order query string', () => {
    const { container } = render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    container.querySelectorAll('iframe').forEach((frame) => {
      // JSX's referrerPolicy maps to the DOM referrerpolicy attribute
      expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    });
  });

  it('renders a loading placeholder behind each iframe (visible until Metabase paints)', () => {
    render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    const placeholders = screen.getAllByText(/loading dashboard…/i);
    expect(placeholders).toHaveLength(3);
  });

  it('hedges the daily-revenue caption so it holds up for Services cross-link arrivals without a purchase event', () => {
    render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    // The old "Your order is in there" overclaimed when the visitor came via
    // the Services → confirmation cross-link (no purchase event fired).
    expect(screen.queryByText(/your order is in there/i)).toBeNull();
    expect(screen.getByText(/orders like yours roll into this bar/i)).toBeInTheDocument();
  });

  it('interpolates the order total into the AOV caption when orderTotal > 0', () => {
    render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    expect(screen.getByText(/your order was \$44\.98/i)).toBeInTheDocument();
    expect(screen.getByText(/90-day AOV trend/i)).toBeInTheDocument();
  });

  it('falls back to a generic AOV caption when orderTotal is 0 (unknown)', () => {
    render(<Tier3Embeds urls={URLS} orderTotal={0} />);
    expect(screen.queryByText(/your order was \$0\.00/i)).toBeNull();
    expect(screen.getByText(/your order against the 90-day AOV trend/i)).toBeInTheDocument();
  });

  it('renders the Tier 3 H2 in the editorial display face (font-display)', () => {
    render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    const heading = screen.getByRole('heading', { level: 2 });
    // 9A-redesign introduced font-display (Instrument Serif) for editorial headings.
    // Tier 3's "payoff" pivot is an editorial moment, not a generic section.
    expect(heading.className).toMatch(/font-display/);
  });

  it('notes that the embeds are live Metabase iframes, not screenshots', () => {
    render(<Tier3Embeds urls={URLS} orderTotal={44.98} />);
    expect(screen.getByText(/live Metabase/i)).toBeInTheDocument();
  });
});

describe('Tier3Embeds fallback when urls is null (env vars not wired)', () => {
  it('still renders the Tier 3 section heading so the narrative surface exists', () => {
    render(<Tier3Embeds urls={null} orderTotal={44.98} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/your order/i);
    expect(screen.getByText(/live Metabase/i)).toBeInTheDocument();
  });

  it('renders a visible fallback block pointing at the IAP-gated dashboard', () => {
    render(<Tier3Embeds urls={null} orderTotal={44.98} />);
    expect(screen.getByTestId('tier3-fallback')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /open the full dashboard/i });
    expect(link).toHaveAttribute('href', 'https://bi.iampatterson.com/dashboard/2');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('does not render any iframes when urls is null', () => {
    const { container } = render(<Tier3Embeds urls={null} orderTotal={44.98} />);
    expect(container.querySelectorAll('iframe')).toHaveLength(0);
  });
});
