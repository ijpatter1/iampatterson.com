/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { DashboardPayoff } from '@/components/demo/ecommerce/dashboard-payoff';

describe('DashboardPayoff (Phase 9F D9)', () => {
  it('renders a single full-dashboard iframe when given a signed URL', () => {
    const url = 'https://bi.iampatterson.com/embed/dashboard/FAKE_JWT#bordered=true&titled=false';
    render(<DashboardPayoff dashboardUrl={url} />);
    const iframes = document.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    expect(iframes[0].getAttribute('src')).toBe(url);
  });

  it('renders the mobile IAP-gated deep link with the Google SSO qualifier', () => {
    render(
      <DashboardPayoff dashboardUrl="https://bi.iampatterson.com/embed/dashboard/x#bordered=true" />,
    );
    const link = screen.getByText(/view full dashboard/i);
    expect(link.getAttribute('href')).toBe('https://bi.iampatterson.com/dashboard/2');
    expect(link.textContent).toMatch(/google sso required · internal bi/i);
  });

  it('renders a visible fallback (no iframe) when dashboardUrl is null', () => {
    render(<DashboardPayoff dashboardUrl={null} />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(
      screen.getByText(/signing env vars aren't wired in this environment/i),
    ).toBeInTheDocument();
    // Fallback points visitors at the live Metabase dashboard
    const link = screen.getByText(/bi\.iampatterson\.com\/dashboard\/2/i);
    expect(link.getAttribute('href')).toBe('https://bi.iampatterson.com/dashboard/2');
  });

  it('wraps iframe in an InlineDiagnostic for visual continuity with the demo aesthetic', () => {
    render(
      <DashboardPayoff dashboardUrl="https://bi.iampatterson.com/embed/dashboard/x#bordered=true" />,
    );
    expect(document.querySelector('[data-inline-diagnostic]')).not.toBeNull();
  });

  it('InlineDiagnostic tag reads TIER 3 · DASHBOARDS', () => {
    render(
      <DashboardPayoff dashboardUrl="https://bi.iampatterson.com/embed/dashboard/x#bordered=true" />,
    );
    expect(screen.getByText(/TIER 3 · DASHBOARDS/i)).toBeInTheDocument();
  });

  it('dashboardId prop threads into the mobile deep-link and fallback text', () => {
    // Explicit id=7 should appear in the mobile deep-link href
    const { rerender } = render(
      <DashboardPayoff
        dashboardUrl="https://bi.iampatterson.com/embed/dashboard/x#bordered=true"
        dashboardId={7}
      />,
    );
    const link = screen.getByText(/view full dashboard/i);
    expect(link.getAttribute('href')).toBe('https://bi.iampatterson.com/dashboard/7');
    // Same id shows in the fallback block when URL is null
    rerender(<DashboardPayoff dashboardUrl={null} dashboardId={7} />);
    expect(screen.getByText(/bi\.iampatterson\.com\/dashboard\/7/i)).toBeInTheDocument();
  });

  it('iframe carries an accessible title and loading=lazy', () => {
    render(
      <DashboardPayoff dashboardUrl="https://bi.iampatterson.com/embed/dashboard/x#bordered=true" />,
    );
    const iframe = document.querySelector('iframe');
    expect(iframe?.getAttribute('title')).toMatch(/dashboard/i);
    expect(iframe?.getAttribute('loading')).toBe('lazy');
  });
});
