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

describe('Tier3Embeds', () => {
  it('renders three iframes in the narrative order: daily revenue → funnel → AOV', () => {
    const { container } = render(<Tier3Embeds urls={URLS} />);
    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(3);
    expect(iframes[0].getAttribute('src')).toBe(URLS.dailyRevenue);
    expect(iframes[1].getAttribute('src')).toBe(URLS.funnel);
    expect(iframes[2].getAttribute('src')).toBe(URLS.aov);
  });

  it('sets descriptive titles on each iframe for assistive tech', () => {
    render(<Tier3Embeds urls={URLS} />);
    expect(screen.getByTitle(/Daily revenue/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Funnel conversion/i)).toBeInTheDocument();
    expect(screen.getByTitle(/AOV trend/i)).toBeInTheDocument();
  });

  it('lazy-loads iframes so they do not block the confirmation paint', () => {
    const { container } = render(<Tier3Embeds urls={URLS} />);
    container.querySelectorAll('iframe').forEach((frame) => {
      expect(frame.getAttribute('loading')).toBe('lazy');
    });
  });

  it('captions each iframe with the narrative prose tying the chart to the visitor order', () => {
    render(<Tier3Embeds urls={URLS} />);
    // Captions match docs/REQUIREMENTS.md deliverable 6b verbatim.
    expect(screen.getByText(/Today's revenue\. Your order is in there\./i)).toBeInTheDocument();
    expect(screen.getByText(/you just converted/i)).toBeInTheDocument();
    expect(screen.getByText(/90-day AOV/i)).toBeInTheDocument();
  });

  it('renders a section heading that frames the Tier 3 payoff', () => {
    render(<Tier3Embeds urls={URLS} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/your order/i);
  });

  it('notes that the embeds are live Metabase iframes, not screenshots', () => {
    render(<Tier3Embeds urls={URLS} />);
    expect(screen.getByText(/live Metabase/i)).toBeInTheDocument();
  });
});
