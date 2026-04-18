/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

const PERSIMMON = '#EA5F2A';
const PHOSPHOR = '#FFA400';

function Consumer() {
  const { toggle, open, close } = useOverlay();
  return (
    <div>
      <button onClick={toggle}>Toggle</button>
      <button onClick={open}>Open</button>
      <button onClick={close}>Close</button>
    </div>
  );
}

const getAccent = () => document.documentElement.style.getPropertyValue('--accent').toUpperCase();

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

describe('OverlayProvider — accent flip', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--accent');
    mockReducedMotion(false);
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--accent');
    jest.useRealTimers();
  });

  it('sets persimmon as the initial accent when overlay is closed', () => {
    render(
      <OverlayProvider>
        <Consumer />
      </OverlayProvider>,
    );
    expect(getAccent()).toBe(PERSIMMON);
  });

  it('flips to phosphor amber ~130ms after the overlay opens', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <OverlayProvider>
        <Consumer />
      </OverlayProvider>,
    );

    await user.click(screen.getByText('Open'));

    // Still on paper accent during the boot hold
    expect(getAccent()).toBe(PERSIMMON);

    act(() => {
      jest.advanceTimersByTime(130);
    });

    expect(getAccent()).toBe(PHOSPHOR);
  });

  it('reverts to persimmon immediately when the overlay closes', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <OverlayProvider>
        <Consumer />
      </OverlayProvider>,
    );

    await user.click(screen.getByText('Open'));
    act(() => {
      jest.advanceTimersByTime(130);
    });
    expect(getAccent()).toBe(PHOSPHOR);

    await user.click(screen.getByText('Close'));
    // Instant revert — no delay on close
    expect(getAccent()).toBe(PERSIMMON);
  });

  it('flips instantly on open under prefers-reduced-motion', async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();

    render(
      <OverlayProvider>
        <Consumer />
      </OverlayProvider>,
    );

    await user.click(screen.getByText('Open'));
    // No timer to advance — the reduced-motion path sets accent synchronously
    expect(getAccent()).toBe(PHOSPHOR);
  });

  it('cancels the pending swap if the overlay closes during the boot hold', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <OverlayProvider>
        <Consumer />
      </OverlayProvider>,
    );

    await user.click(screen.getByText('Open'));
    expect(getAccent()).toBe(PERSIMMON);

    // Close before the 130ms delay elapses
    await user.click(screen.getByText('Close'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Accent should have stayed on paper — the pending timer was cleared
    expect(getAccent()).toBe(PERSIMMON);
  });
});
