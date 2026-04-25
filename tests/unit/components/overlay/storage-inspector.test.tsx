/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { StorageInspector } from '@/components/overlay/consent/storage-inspector';
import type { StorageSnapshot } from '@/lib/identity/storage-inspector';

function snap(entries: StorageSnapshot['entries']): StorageSnapshot {
  return { entries, takenAt: 0 };
}

describe('StorageInspector', () => {
  it('renders the section heading regardless of snapshot contents', () => {
    render(<StorageInspector snapshot={snap([])} />);
    expect(screen.getByTestId('consent-storage-inspector')).toBeInTheDocument();
  });

  it('renders one collapsible group per always-shown category even when empty', () => {
    render(<StorageInspector snapshot={snap([])} />);
    for (const cat of ['app-identity', 'analytics', 'consent', 'third-party']) {
      const group = screen.getByTestId(`storage-group-${cat}`);
      expect(group).toHaveAttribute('data-storage-category', cat);
    }
  });

  it('hides the uncategorized group when its count is 0', () => {
    render(<StorageInspector snapshot={snap([])} />);
    expect(screen.queryByTestId('storage-group-uncategorized')).toBeNull();
  });

  it('shows the uncategorized group when at least one key falls into it', () => {
    render(
      <StorageInspector
        snapshot={snap([
          { name: 'mystery', value: 'x', source: 'cookie', category: 'uncategorized' },
        ])}
      />,
    );
    expect(screen.getByTestId('storage-group-uncategorized')).toBeInTheDocument();
  });

  it('renders one row per entry inside its category group', () => {
    render(
      <StorageInspector
        snapshot={snap([
          { name: '_iap_aid', value: 'aid-uuid-1234', source: 'cookie', category: 'app-identity' },
          { name: '_iap_sid', value: 'sid-uuid-5678', source: 'cookie', category: 'app-identity' },
          { name: '_ga', value: 'GA1.1.123.456', source: 'cookie', category: 'analytics' },
        ])}
      />,
    );
    const appGroup = screen.getByTestId('storage-group-app-identity');
    expect(appGroup.querySelectorAll('[data-testid^="storage-row-"]')).toHaveLength(2);
    const analyticsGroup = screen.getByTestId('storage-group-analytics');
    expect(analyticsGroup.querySelectorAll('[data-testid^="storage-row-"]')).toHaveLength(1);
  });

  // Bug fix 2026-04-25 (mobile spill): on iPhone-SE-width viewports the
  // single-row layout `flex items-baseline gap-3` could not fit name +
  // source + 40-char-truncated value + reveal button, so `flex-1 min-w-0
  // break-all` on the value column squeezed to ~1 char and the value
  // rendered one character per line vertically. The responsive layout
  // stacks name+source on row 1 / value+reveal on row 2 on mobile and
  // restores the single horizontal row on sm+. This pin asserts the
  // class string contains the responsive breakpoint shape so a future
  // cleanup pass that "matches the rest of the overlay" doesn't strip
  // it again — the content shape (long opaque cookie/JSON values) is
  // genuinely different from consent labels or destination-chip names.
  it('uses a flex-col → sm:flex-row responsive stack so long values do not spill on mobile', () => {
    render(
      <StorageInspector
        snapshot={snap([
          { name: '_iap_aid', value: 'short', source: 'cookie', category: 'app-identity' },
        ])}
      />,
    );
    const row = screen.getByTestId('storage-row-cookie-_iap_aid');
    expect(row.className).toContain('flex-col');
    expect(row.className).toContain('sm:flex-row');
  });

  it('row carries name + source badge + data attributes', () => {
    render(
      <StorageInspector
        snapshot={snap([
          { name: '_iap_aid', value: 'short-value', source: 'cookie', category: 'app-identity' },
        ])}
      />,
    );
    const row = screen.getByTestId('storage-row-cookie-_iap_aid');
    expect(row).toHaveAttribute('data-storage-source', 'cookie');
    expect(row).toHaveAttribute('data-storage-category', 'app-identity');
    expect(row.textContent).toContain('_iap_aid');
    expect(row.textContent?.toLowerCase()).toContain('cookie');
  });

  it('renders empty-state placeholder when a category has no entries', () => {
    render(<StorageInspector snapshot={snap([])} />);
    const consentGroup = screen.getByTestId('storage-group-consent');
    // Honest placeholder — "none yet" is the spec language; an em-dash would also be accepted.
    expect(consentGroup.textContent?.toLowerCase()).toMatch(/none yet|—/);
  });

  it('truncates long values and reveals the full value on click', () => {
    const longValue = 'a'.repeat(120);
    render(
      <StorageInspector
        snapshot={snap([
          { name: 'CookieConsent', value: longValue, source: 'cookie', category: 'consent' },
        ])}
      />,
    );
    const row = screen.getByTestId('storage-row-cookie-CookieConsent');
    const valueEl = within(row).getByTestId('storage-value');
    expect(valueEl.textContent?.length ?? 0).toBeLessThan(longValue.length);
    fireEvent.click(within(row).getByTestId('storage-row-reveal'));
    expect(within(row).getByTestId('storage-value').textContent).toBe(longValue);
  });

  it('does not show a reveal button when the value is short enough', () => {
    render(
      <StorageInspector
        snapshot={snap([
          { name: '_iap_aid', value: 'short', source: 'cookie', category: 'app-identity' },
        ])}
      />,
    );
    const row = screen.getByTestId('storage-row-cookie-_iap_aid');
    expect(within(row).queryByTestId('storage-row-reveal')).toBeNull();
  });

  it('renders the JS-cookie-API limitation footnote', () => {
    render(<StorageInspector snapshot={snap([])} />);
    const section = screen.getByTestId('consent-storage-inspector');
    // The footnote names the limitation honestly so visitors don't wonder why expiry/domain isn't shown.
    expect(section.textContent?.toLowerCase()).toMatch(/expiry|domain|metadata/);
  });

  it('includes empty-third-party as proof that consent denial held', () => {
    render(<StorageInspector snapshot={snap([])} />);
    const tpGroup = screen.getByTestId('storage-group-third-party');
    expect(tpGroup.textContent?.toLowerCase()).toMatch(/none yet|—/);
  });
});
