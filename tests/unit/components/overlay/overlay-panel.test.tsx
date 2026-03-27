/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OverlayPanel } from '@/components/overlay/overlay-panel';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn().mockReturnValue('/'),
}));

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: jest.fn().mockReturnValue({
    status: 'connected',
    events: [],
    error: null,
    clearEvents: jest.fn(),
  }),
}));

function OpenThenRender() {
  const { open } = useOverlay();
  return (
    <>
      <button onClick={open}>OpenOverlay</button>
      <OverlayPanel />
    </>
  );
}

describe('OverlayPanel', () => {
  it('renders nothing when overlay is closed', () => {
    render(
      <OverlayProvider>
        <OverlayPanel />
      </OverlayProvider>,
    );
    expect(screen.queryByTestId('desktop-overlay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-bottom-sheet')).not.toBeInTheDocument();
  });

  it('renders both desktop and mobile overlays when open', async () => {
    const user = userEvent.setup();
    render(
      <OverlayProvider>
        <OpenThenRender />
      </OverlayProvider>,
    );
    await user.click(screen.getByText('OpenOverlay'));
    // Both exist in DOM, CSS media queries control visibility
    expect(screen.getByTestId('desktop-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-bottom-sheet')).toBeInTheDocument();
  });

  it('shows connection status', async () => {
    const user = userEvent.setup();
    render(
      <OverlayProvider>
        <OpenThenRender />
      </OverlayProvider>,
    );
    await user.click(screen.getByText('OpenOverlay'));
    expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
  });

  it('has view mode tabs', async () => {
    const user = userEvent.setup();
    render(
      <OverlayProvider>
        <OpenThenRender />
      </OverlayProvider>,
    );
    await user.click(screen.getByText('OpenOverlay'));
    // Desktop overlay should have tab buttons
    expect(screen.getAllByRole('button', { name: /timeline/i }).length).toBeGreaterThan(0);
  });
});
