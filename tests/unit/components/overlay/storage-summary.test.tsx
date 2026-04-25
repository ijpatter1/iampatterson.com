/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import { StorageSummary } from '@/components/overlay/overview/storage-summary';
import type { StorageSnapshot } from '@/lib/identity/storage-inspector';

function snap(entries: StorageSnapshot['entries']): StorageSnapshot {
  return { entries, takenAt: 0 };
}

describe('StorageSummary', () => {
  it('renders the section kicker + heading regardless of snapshot contents', () => {
    render(<StorageSummary snapshot={snap([])} />);
    expect(screen.getByTestId('overview-storage')).toBeInTheDocument();
  });

  it('always shows app-identity, analytics, consent, third-party chips even when count is 0', () => {
    render(<StorageSummary snapshot={snap([])} />);
    const section = screen.getByTestId('overview-storage');
    for (const cat of ['app-identity', 'analytics', 'consent', 'third-party']) {
      const chip = within(section).getByTestId(`storage-chip-${cat}`);
      expect(chip).toHaveAttribute('data-storage-category', cat);
      expect(chip).toHaveAttribute('data-key-count', '0');
    }
  });

  it('hides the uncategorized chip when its count is 0 (fallback bucket, not a load-bearing claim)', () => {
    render(<StorageSummary snapshot={snap([])} />);
    const section = screen.getByTestId('overview-storage');
    expect(within(section).queryByTestId('storage-chip-uncategorized')).toBeNull();
  });

  it('shows the uncategorized chip when at least one key falls into it', () => {
    render(
      <StorageSummary
        snapshot={snap([
          { name: 'mystery_key', value: 'x', source: 'cookie', category: 'uncategorized' },
        ])}
      />,
    );
    const chip = screen.getByTestId('storage-chip-uncategorized');
    expect(chip).toHaveAttribute('data-key-count', '1');
  });

  it('counts keys per category accurately across mixed snapshot', () => {
    render(
      <StorageSummary
        snapshot={snap([
          { name: '_iap_aid', value: 'x', source: 'cookie', category: 'app-identity' },
          { name: '_iap_sid', value: 'x', source: 'cookie', category: 'app-identity' },
          {
            name: 'iampatterson.session_state',
            value: 'x',
            source: 'sessionStorage',
            category: 'app-identity',
          },
          { name: '_ga', value: 'x', source: 'cookie', category: 'analytics' },
          { name: 'CookieConsent', value: 'x', source: 'cookie', category: 'consent' },
        ])}
      />,
    );
    expect(screen.getByTestId('storage-chip-app-identity')).toHaveAttribute('data-key-count', '3');
    expect(screen.getByTestId('storage-chip-analytics')).toHaveAttribute('data-key-count', '1');
    expect(screen.getByTestId('storage-chip-consent')).toHaveAttribute('data-key-count', '1');
    expect(screen.getByTestId('storage-chip-third-party')).toHaveAttribute('data-key-count', '0');
  });

  it('chip label includes the category label and key count', () => {
    render(
      <StorageSummary
        snapshot={snap([
          { name: '_iap_aid', value: 'x', source: 'cookie', category: 'app-identity' },
          { name: '_iap_sid', value: 'x', source: 'cookie', category: 'app-identity' },
        ])}
      />,
    );
    const chip = screen.getByTestId('storage-chip-app-identity');
    expect(chip.textContent).toContain('app identity');
    expect(chip.textContent).toContain('2');
  });

  it('singular "key" when count is exactly 1, plural "keys" otherwise', () => {
    render(
      <StorageSummary
        snapshot={snap([{ name: '_ga', value: 'x', source: 'cookie', category: 'analytics' }])}
      />,
    );
    expect(screen.getByTestId('storage-chip-analytics').textContent).toMatch(/1 key\b/);
    // Empty category — plural even at 0 ("0 keys" reads more naturally than "0 key").
    expect(screen.getByTestId('storage-chip-consent').textContent).toMatch(/0 keys/);
  });
});
