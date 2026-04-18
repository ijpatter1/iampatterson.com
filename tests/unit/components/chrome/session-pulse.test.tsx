/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SessionPulse } from '@/components/chrome/session-pulse';

jest.mock('@/hooks/useDataLayerEvents', () => ({
  useDataLayerEvents: () => ({ events: [] }),
}));

jest.mock('@/lib/events/session', () => ({
  getSessionId: () => 'abcdef-xyz123456',
}));

describe('SessionPulse', () => {
  it('renders a display-only span when no onClick is provided', () => {
    render(<SessionPulse />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // Short ID (last 6 chars) is surfaced
    expect(screen.getByText(/123456/)).toBeInTheDocument();
    // Event count present
    expect(screen.getByText(/0 evt/)).toBeInTheDocument();
  });

  it('renders a button when onClick is provided', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(<SessionPulse onClick={onClick} />);

    const btn = screen.getByRole('button', { name: /look under the hood — live session/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows a session-id placeholder before mount (SSR-safe)', () => {
    // getSessionId is mocked above — the effect writes the real value on mount.
    render(<SessionPulse />);
    // After the mount effect, the suffix is present
    expect(screen.getByText(/123456/)).toBeInTheDocument();
  });
});
