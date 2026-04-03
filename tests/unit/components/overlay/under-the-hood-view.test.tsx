/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UnderTheHoodView } from '@/components/overlay/under-the-hood-view';

const mockClose = jest.fn();

jest.mock('@/components/overlay/overlay-context', () => ({
  useOverlay: () => ({
    isOpen: true,
    toggle: mockClose,
    open: jest.fn(),
    close: mockClose,
  }),
}));

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    events: [],
    status: 'disconnected',
  }),
}));

jest.mock('@/hooks/useFilteredEvents', () => ({
  useFilteredEvents: (events: unknown[]) => ({
    filteredEvents: events,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UnderTheHoodView', () => {
  it('renders as a full-page view when overlay is open', () => {
    render(<UnderTheHoodView />);
    // Should render a full-page container
    const view = screen.getByTestId('under-the-hood-view');
    expect(view).toBeInTheDocument();
    expect(view.className).toContain('fixed');
    expect(view.className).toContain('inset-0');
  });

  it('renders a close button', () => {
    render(<UnderTheHoodView />);
    expect(screen.getByRole('button', { name: /close|back to site/i })).toBeInTheDocument();
  });

  it('calls close when the close button is clicked', async () => {
    const user = userEvent.setup();
    render(<UnderTheHoodView />);
    const closeBtn = screen.getByRole('button', { name: /close|back to site/i });
    await user.click(closeBtn);
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders view mode tabs', () => {
    render(<UnderTheHoodView />);
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Narrative')).toBeInTheDocument();
    expect(screen.getByText('Consent')).toBeInTheDocument();
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
  });

  it('renders a heading identifying the view', () => {
    render(<UnderTheHoodView />);
    expect(screen.getByText(/under the hood/i)).toBeInTheDocument();
  });
});
