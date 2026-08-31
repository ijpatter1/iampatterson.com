/**
 * @jest-environment jsdom
 *
 * Claudish translator — output action row (feat/claudish M2, phase D).
 * Copy · Rate · Share, all disabled until output exists.
 */
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackClaudishShare: jest.fn(),
  trackClaudishRate: jest.fn(),
}));

import { OutputActions } from '@/components/claudish/output-actions';

describe('OutputActions', () => {
  it('renders copy, rate, and share buttons', () => {
    render(
      <OutputActions source="in" target="out text" direction="en2cl" />
    );
    expect(screen.getByRole('button', { name: /copy translation/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /rate translation/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /share translation/i })).toBeEnabled();
  });

  it('disables all three without output', () => {
    render(<OutputActions source="in" target="" direction="en2cl" />);
    expect(screen.getByRole('button', { name: /copy translation/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rate translation/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /share translation/i })).toBeDisabled();
  });
});
