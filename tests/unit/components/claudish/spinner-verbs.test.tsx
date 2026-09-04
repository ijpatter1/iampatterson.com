/**
 * @jest-environment jsdom
 *
 * Claudish translator — spinner verb loader (feat/claudish M2, phase D).
 * Cycles Claude Code's spinner verbs while awaiting the first token;
 * a static single verb under prefers-reduced-motion.
 */
import { act, render, screen } from '@testing-library/react';

jest.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: jest.fn(() => false),
}));

import { SpinnerVerbs } from '@/components/claudish/spinner-verbs';
import { SPINNER_VERBS } from '@/lib/claudish/spinner-verbs';
import { SPINNER_VERB_INTERVAL_MS } from '@/lib/claudish/limits';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const mockReducedMotion = usePrefersReducedMotion as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  mockReducedMotion.mockReturnValue(false);
});
afterEach(() => {
  jest.useRealTimers();
});

describe('SpinnerVerbs', () => {
  it('shows the first verb immediately and cycles on the interval', () => {
    render(<SpinnerVerbs />);
    expect(screen.getByText(SPINNER_VERBS[0])).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(SPINNER_VERB_INTERVAL_MS);
    });
    expect(screen.getByText(SPINNER_VERBS[1])).toBeInTheDocument();
  });

  it('wraps around the verb list', () => {
    render(<SpinnerVerbs />);
    act(() => {
      jest.advanceTimersByTime(SPINNER_VERB_INTERVAL_MS * SPINNER_VERBS.length);
    });
    expect(screen.getByText(SPINNER_VERBS[0])).toBeInTheDocument();
  });

  it('holds a single static verb under prefers-reduced-motion', () => {
    mockReducedMotion.mockReturnValue(true);
    render(<SpinnerVerbs />);
    expect(screen.getByText(SPINNER_VERBS[0])).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(SPINNER_VERB_INTERVAL_MS * 3);
    });
    expect(screen.getByText(SPINNER_VERBS[0])).toBeInTheDocument();
  });

  it('is hidden from the accessibility tree (aria-busy on the panel is the signal)', () => {
    const { container } = render(<SpinnerVerbs />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
