/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FullPageDiagnostic } from '@/components/demo/reveal/full-page-diagnostic';

describe('FullPageDiagnostic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders the dialog with role="dialog"', () => {
    render(
      <FullPageDiagnostic
        lines={[{ text: 'purchase event fired', tag: 'OK' }]}
        onComplete={jest.fn()}
      />,
    );
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
  });

  it('progressively reveals lines over the duration', () => {
    render(
      <FullPageDiagnostic
        duration={1500}
        lines={[
          { text: 'first', tag: 'OK' },
          { text: 'second', tag: 'OK' },
          { text: 'third', tag: 'OK' },
        ]}
        onComplete={jest.fn()}
      />,
    );
    // perLine = 1500 / (3 + 1) = 375ms
    expect(screen.queryByText('first')).not.toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(376);
    });
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.queryByText('second')).not.toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(375);
    });
    expect(screen.getByText('second')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(375);
    });
    expect(screen.getByText('third')).toBeInTheDocument();
  });

  it('calls onComplete after the duration elapses', () => {
    const onComplete = jest.fn();
    render(
      <FullPageDiagnostic
        duration={1500}
        lines={[{ text: 'a' }, { text: 'b' }]}
        onComplete={onComplete}
      />,
    );
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1499);
    });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(2);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('any keydown skips the sequence and calls onComplete immediately', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onComplete = jest.fn();
    render(
      <FullPageDiagnostic
        duration={1500}
        lines={[{ text: 'a' }, { text: 'b' }]}
        onComplete={onComplete}
      />,
    );
    expect(onComplete).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('backdrop click does NOT skip the sequence', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onComplete = jest.fn();
    render(<FullPageDiagnostic duration={1500} lines={[{ text: 'a' }]} onComplete={onComplete} />);
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    await user.click(dialog);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('onComplete is only called once, even if multiple skip events occur', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onComplete = jest.fn();
    render(<FullPageDiagnostic duration={1500} lines={[{ text: 'a' }]} onComplete={onComplete} />);
    await user.keyboard('{Enter}');
    await user.keyboard('{Space}');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders status tags (OK / SKIP) on lines that have them', () => {
    render(
      <FullPageDiagnostic
        duration={1500}
        lines={[
          { text: 'one', tag: 'OK' },
          { text: 'two', tag: 'SKIP' },
        ]}
        onComplete={jest.fn()}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByText('[OK]')).toBeInTheDocument();
    expect(screen.getByText('[SKIP]')).toBeInTheDocument();
  });

  it('renders the > prompt prefix on each visible line', () => {
    render(
      <FullPageDiagnostic
        duration={1500}
        lines={[{ text: 'one', tag: 'OK' }]}
        onComplete={jest.fn()}
      />,
    );
    // perLine = 1500 / (1 + 1) = 750ms — advance past it to reveal the line
    act(() => {
      jest.advanceTimersByTime(800);
    });
    const prompts = document.querySelectorAll('[data-fpd-prompt]');
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0].textContent).toBe('>');
  });

  it('reduced-motion: skips the typed sequence and calls onComplete immediately', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
    const onComplete = jest.fn();
    const { container } = render(
      <FullPageDiagnostic
        duration={1500}
        lines={[{ text: 'a' }, { text: 'b' }]}
        onComplete={onComplete}
      />,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
    // No dialog rendered under reduced-motion (skipped outright)
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('cleans up keydown listener on unmount (no leaks)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onComplete = jest.fn();
    const { unmount } = render(
      <FullPageDiagnostic duration={1500} lines={[{ text: 'a' }]} onComplete={onComplete} />,
    );
    unmount();
    // After unmount, keydown should not affect onComplete (already 0).
    await user.keyboard('{Enter}');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('uses default duration ~4500ms when not provided (UAT r1 item 14)', () => {
    // Pre-UAT this was 1900ms — with 7 lines that gave each line only
    // ~240ms before the next arrived + ~240ms to read the final line.
    // Bumped to 4500ms so readers have ~640ms per line.
    const onComplete = jest.fn();
    render(<FullPageDiagnostic lines={[{ text: 'a' }]} onComplete={onComplete} />);
    act(() => {
      jest.advanceTimersByTime(4499);
    });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(2);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('dialog has aria-modal="true" and receives focus on mount (focus trap)', () => {
    // Seed a focused element outside the dialog to verify focus moves to the
    // dialog + is restored on unmount.
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { unmount } = render(
      <FullPageDiagnostic lines={[{ text: 'a' }]} onComplete={jest.fn()} />,
    );
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(dialog);

    unmount();
    // Focus restored to the previously-focused element
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('Tab keydown keeps focus trapped on the dialog (does not skip)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onComplete = jest.fn();
    render(<FullPageDiagnostic lines={[{ text: 'a' }]} onComplete={onComplete} />);
    // Tab should NOT skip (only non-Tab keys skip)
    await user.keyboard('{Tab}');
    expect(onComplete).not.toHaveBeenCalled();
    // Focus remains on the dialog
    const dialog = document.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
  });

  it('renders into a portal at document.body', () => {
    render(<FullPageDiagnostic lines={[{ text: 'a' }]} onComplete={jest.fn()} />);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // Should be a direct child of body, not nested in the test container
    expect(dialog?.parentElement).toBe(document.body);
  });
});
