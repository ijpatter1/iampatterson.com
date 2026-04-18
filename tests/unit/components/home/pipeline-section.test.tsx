/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

jest.mock('@/lib/events/track', () => ({
  trackClickCta: jest.fn(),
}));

let mockLiveEvents: PipelineEvent[] = [];
jest.mock('@/hooks/useLiveEvents', () => ({
  useLiveEvents: () => ({ events: mockLiveEvents, source: 'dataLayer' }),
}));

import { PipelineSection } from '@/components/home/pipeline-section';
import { OverlayProvider, useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

function Probe() {
  const { isOpen } = useOverlay();
  return <span data-testid="overlay-status">{isOpen ? 'open' : 'closed'}</span>;
}

function renderSection() {
  return render(
    <OverlayProvider>
      <PipelineSection />
      <Probe />
    </OverlayProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLiveEvents = [];
});

afterEach(() => {
  jest.useRealTimers();
});

function makeEvent(id: string, name: string, ts: string): PipelineEvent {
  return {
    pipeline_id: id,
    received_at: ts,
    session_id: 'test',
    event_name: name,
    timestamp: ts,
    page_path: '/pipeline',
    page_title: '',
    page_location: '',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing: [],
  };
}

describe('PipelineSection', () => {
  it('renders the editorial heading with measurement emphasis', () => {
    renderSection();
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.textContent).toMatch(/Your session is.*being.*measured.*right now/s);
  });

  it('renders all five pipeline stages', () => {
    renderSection();
    expect(screen.getByTestId('pipeline-stage-01')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-stage-02')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-stage-03')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-stage-04')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-stage-05')).toBeInTheDocument();
    expect(screen.getByText('Browser')).toBeInTheDocument();
    expect(screen.getByText('Client GTM')).toBeInTheDocument();
    expect(screen.getByText('sGTM')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
  });

  it('rotates the active stage on an interval', () => {
    jest.useFakeTimers();
    renderSection();
    // Initial: stage 01 active
    expect(screen.getByTestId('pipeline-stage-01').dataset.active).toBe('true');
    act(() => {
      jest.advanceTimersByTime(1400);
    });
    expect(screen.getByTestId('pipeline-stage-02').dataset.active).toBe('true');
    act(() => {
      jest.advanceTimersByTime(1400);
    });
    expect(screen.getByTestId('pipeline-stage-03').dataset.active).toBe('true');
  });

  it('renders a waiting-for-events placeholder when the event stream is empty', () => {
    mockLiveEvents = [];
    renderSection();
    expect(screen.getByText(/waiting for events.*interact with the page/i)).toBeInTheDocument();
  });

  it('renders real events in the log feed when available', () => {
    mockLiveEvents = [
      makeEvent('e1', 'page_view', '2026-04-18T14:30:00.000Z'),
      makeEvent('e2', 'scroll_depth', '2026-04-18T14:30:02.000Z'),
    ];
    renderSection();
    const feed = screen.getByTestId('pipeline-log-feed');
    expect(feed.textContent).toContain('page_view');
    expect(feed.textContent).toContain('scroll_depth');
    expect(feed.textContent).toContain('/pipeline');
  });

  it('Watch it live button opens the overlay and fires click_cta', async () => {
    const user = userEvent.setup();
    renderSection();
    const cta = screen.getByRole('button', { name: /watch it live/i });
    await user.click(cta);
    expect(screen.getByTestId('overlay-status')).toHaveTextContent('open');
    expect(trackClickCta).toHaveBeenCalledWith('Watch it live', 'pipeline-section');
  });
});
