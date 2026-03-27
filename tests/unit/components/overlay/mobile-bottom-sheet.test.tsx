/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';

import { MobileBottomSheetShell } from '@/components/overlay/mobile-bottom-sheet-shell';
import { OverlayProvider } from '@/components/overlay/overlay-context';

function renderShell(status = 'connected') {
  return render(
    <OverlayProvider>
      <MobileBottomSheetShell status={status}>
        <span>Sheet Content</span>
      </MobileBottomSheetShell>
    </OverlayProvider>,
  );
}

describe('MobileBottomSheetShell', () => {
  it('renders children', () => {
    renderShell();
    expect(screen.getByText('Sheet Content')).toBeInTheDocument();
  });

  it('has the mobile-bottom-sheet test id', () => {
    renderShell();
    expect(screen.getByTestId('mobile-bottom-sheet')).toBeInTheDocument();
  });

  it('has a drag handle', () => {
    renderShell();
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
  });

  it('shows "Live" when status is connected', () => {
    renderShell('connected');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows raw status when not connected', () => {
    renderShell('disconnected');
    expect(screen.getByText('disconnected')).toBeInTheDocument();
  });

  it('has an accessible backdrop', () => {
    renderShell();
    const backdrop = screen.getByRole('button', { name: /close overlay/i });
    expect(backdrop).toBeInTheDocument();
  });

  it('has the Event Stream title', () => {
    renderShell();
    expect(screen.getByText('Event Stream')).toBeInTheDocument();
  });
});
