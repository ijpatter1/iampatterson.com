/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DesktopOverlayShell } from '@/components/overlay/desktop-overlay-shell';

describe('DesktopOverlayShell', () => {
  it('renders children', () => {
    render(
      <DesktopOverlayShell status="connected">
        <span>Test Content</span>
      </DesktopOverlayShell>,
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('has the desktop-overlay test id', () => {
    render(
      <DesktopOverlayShell status="connected">
        <span>Content</span>
      </DesktopOverlayShell>,
    );
    expect(screen.getByTestId('desktop-overlay')).toBeInTheDocument();
  });

  it('shows "Live" when status is connected', () => {
    render(
      <DesktopOverlayShell status="connected">
        <span>Content</span>
      </DesktopOverlayShell>,
    );
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows raw status when not connected', () => {
    render(
      <DesktopOverlayShell status="reconnecting">
        <span>Content</span>
      </DesktopOverlayShell>,
    );
    expect(screen.getByText('reconnecting')).toBeInTheDocument();
  });

  it('has the Event Stream title', () => {
    render(
      <DesktopOverlayShell status="connected">
        <span>Content</span>
      </DesktopOverlayShell>,
    );
    expect(screen.getByText('Event Stream')).toBeInTheDocument();
  });
});
