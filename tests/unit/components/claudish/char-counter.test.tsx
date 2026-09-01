/**
 * @jest-environment jsdom
 *
 * Claudish translator — character counter (feat/claudish M2, phase D).
 * "412 / 3,000 · 9 em dashes" — the counter shows the REAL cap (user
 * decision) and the em-dash tail is the joke's dashboard.
 */
import { render, screen } from '@testing-library/react';

import { CharCounter } from '@/components/claudish/char-counter';

describe('CharCounter', () => {
  it('renders count, cap, and em-dash tally with locale thousands separators', () => {
    render(<CharCounter text={'a'.repeat(412) + ' — '.repeat(9)} />);
    // 412 + 9×3 = 439 chars, 9 em dashes
    expect(screen.getByText('439 / 3,000 · 9 em dashes')).toBeInTheDocument();
  });

  it('singularizes a single em dash', () => {
    render(<CharCounter text={'word — word'} />);
    expect(screen.getByText('11 / 3,000 · 1 em dash')).toBeInTheDocument();
  });

  it('omits the em-dash tail entirely at zero', () => {
    render(<CharCounter text={'plain text'} />);
    expect(screen.getByText('10 / 3,000')).toBeInTheDocument();
    expect(screen.queryByText(/em dash/)).not.toBeInTheDocument();
  });

  it('renders 0 for empty input', () => {
    render(<CharCounter text="" />);
    expect(screen.getByText('0 / 3,000')).toBeInTheDocument();
  });
});
