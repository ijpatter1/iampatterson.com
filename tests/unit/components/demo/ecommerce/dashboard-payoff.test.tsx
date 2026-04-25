/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';

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

  it('InlineDiagnostic tag describes what the panel is (no internal "Tier N" jargon)', () => {
    // Pass-2 product-review Minor #4: renamed from "TIER 3 · DASHBOARDS"
    // to plain descriptive "DASHBOARDS · LIVE" so the tag doesn't
    // leak the internal tier taxonomy the UAT r1 item 1 response
    // specifically rejected.
    render(
      <DashboardPayoff dashboardUrl="https://bi.iampatterson.com/embed/dashboard/x#bordered=true" />,
    );
    expect(screen.getByText(/DASHBOARDS · LIVE/i)).toBeInTheDocument();
    // And the rejected jargon is gone.
    expect(screen.queryByText(/TIER 3/i)).not.toBeInTheDocument();
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

// ---------------------------------------------------------------------------
// Phase 10d D2 (graceful degradation): iframe load timeout.
// Closes carry-forward 9B follow-up #2 (LiveEmbedFrame load-failure timeout)
// against the current 9F-era DashboardPayoff shape. The 15s budget sits
// well under the ~60s JVM cold-start envelope documented in 9B follow-up #1
// (`cpu-throttling=true`) but is long enough that a typical warm load —
// single-digit seconds — clears the timer cleanly before the fallback fires.
// Reference: docs/perf/error-handling-audit-2026-04-25.md path B.
// ---------------------------------------------------------------------------

describe('DashboardPayoff load timeout (Phase 10d D2)', () => {
  const validUrl = 'https://bi.iampatterson.com/embed/dashboard/x#bordered=true';

  it('renders the load-timeout fallback when the iframe never fires onLoad within 15s', () => {
    jest.useFakeTimers();
    try {
      render(<DashboardPayoff dashboardUrl={validUrl} />);

      // Initially the iframe is mounted (Metabase is taking its time loading).
      expect(document.querySelector('iframe')).not.toBeNull();

      // Advance time past the 15s budget without firing onLoad.
      act(() => {
        jest.advanceTimersByTime(15_000);
      });

      // Iframe is unmounted; fallback prose explains the situation honestly
      // and surfaces the same Google-SSO deep-link as the null-signer path.
      expect(document.querySelector('iframe')).toBeNull();
      // Title pin (load-timeout-specific): "dashboard didn't load in time"
      expect(screen.getByText(/didn't load in time/i)).toBeInTheDocument();
      // Body honesty pin: explicit cold-start framing for the visitor.
      expect(screen.getByText(/cold-start/i)).toBeInTheDocument();
      const link = screen.getByText(/bi\.iampatterson\.com\/dashboard\/2/i);
      expect(link.getAttribute('href')).toBe('https://bi.iampatterson.com/dashboard/2');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not flip to the timeout fallback when iframe fires onLoad before 15s', () => {
    jest.useFakeTimers();
    try {
      render(<DashboardPayoff dashboardUrl={validUrl} />);
      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();

      // Iframe loads at 3s — well under the 15s budget.
      act(() => {
        jest.advanceTimersByTime(3_000);
        fireEvent.load(iframe!);
      });

      // Advance past 15s; the fallback must NOT have rendered because
      // onLoad cancelled the timer.
      act(() => {
        jest.advanceTimersByTime(13_000);
      });

      expect(document.querySelector('iframe')).not.toBeNull();
      expect(screen.queryByText(/didn't load in time/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not schedule a timer when dashboardUrl is null (null-signer path is unchanged)', () => {
    jest.useFakeTimers();
    try {
      render(<DashboardPayoff dashboardUrl={null} />);
      // No iframe to load → no timer to wait on. Advancing 15s should
      // leave the null-signer fallback rendered without changing.
      act(() => {
        jest.advanceTimersByTime(15_000);
      });
      expect(document.querySelector('iframe')).toBeNull();
      expect(
        screen.getByText(/signing env vars aren't wired in this environment/i),
      ).toBeInTheDocument();
      // The load-timeout-specific copy must NOT appear here; this is the
      // null-signer path, not the load-timeout path.
      expect(screen.queryByText(/didn't load in time/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/cold-start/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('threads dashboardId into the load-timeout fallback deep-link', () => {
    jest.useFakeTimers();
    try {
      render(<DashboardPayoff dashboardUrl={validUrl} dashboardId={7} />);
      act(() => {
        jest.advanceTimersByTime(15_000);
      });
      const link = screen.getByText(/bi\.iampatterson\.com\/dashboard\/7/i);
      expect(link.getAttribute('href')).toBe('https://bi.iampatterson.com/dashboard/7');
    } finally {
      jest.useRealTimers();
    }
  });
});
