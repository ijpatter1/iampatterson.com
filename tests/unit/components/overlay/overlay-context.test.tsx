/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';

function TestConsumer() {
  const { isOpen, toggle, open, close } = useOverlay();
  return (
    <div>
      <span data-testid="status">{isOpen ? 'open' : 'closed'}</span>
      <button onClick={toggle}>Toggle</button>
      <button onClick={open}>Open</button>
      <button onClick={close}>Close</button>
    </div>
  );
}

describe('OverlayContext', () => {
  it('defaults to closed', () => {
    render(
      <OverlayProvider>
        <TestConsumer />
      </OverlayProvider>,
    );
    expect(screen.getByTestId('status')).toHaveTextContent('closed');
  });

  it('toggles open and closed', async () => {
    const user = userEvent.setup();
    render(
      <OverlayProvider>
        <TestConsumer />
      </OverlayProvider>,
    );
    await user.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('status')).toHaveTextContent('open');
    await user.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('status')).toHaveTextContent('closed');
  });

  it('open() sets isOpen to true', async () => {
    const user = userEvent.setup();
    render(
      <OverlayProvider>
        <TestConsumer />
      </OverlayProvider>,
    );
    await user.click(screen.getByText('Open'));
    expect(screen.getByTestId('status')).toHaveTextContent('open');
  });

  it('close() sets isOpen to false', async () => {
    const user = userEvent.setup();
    render(
      <OverlayProvider>
        <TestConsumer />
      </OverlayProvider>,
    );
    // Open first, then close
    await user.click(screen.getByText('Open'));
    await user.click(screen.getByText('Close'));
    expect(screen.getByTestId('status')).toHaveTextContent('closed');
  });

  it('throws when useOverlay is used outside OverlayProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useOverlay must be used within an OverlayProvider',
    );
    spy.mockRestore();
  });
});
