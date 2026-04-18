/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { LiveStrip } from '@/components/chrome/live-strip';

jest.mock('@/lib/events/session', () => ({
  getSessionId: () => 'aaaaaaaa-12345678',
}));

describe('LiveStrip', () => {
  it('mounts with the expected data-testid', () => {
    render(<LiveStrip />);
    expect(screen.getByTestId('live-strip')).toBeInTheDocument();
  });

  it('renders all six ticker fields', () => {
    render(<LiveStrip />);
    // Items are duplicated for seamless looping, so use getAllByText
    expect(screen.getAllByText('SESSION').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('STACK').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('CONSENT').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('PIPELINE').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('DASHBOARDS').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('ATTRIB').length).toBeGreaterThanOrEqual(2);
  });

  it('includes the short session ID suffix in the SESSION field', () => {
    render(<LiveStrip />);
    expect(screen.getAllByText(/12345678/).length).toBeGreaterThan(0);
  });

  it('declares the pipeline path in the STACK field', () => {
    render(<LiveStrip />);
    expect(screen.getAllByText(/GTM → sGTM → BigQuery/).length).toBeGreaterThan(0);
  });
});
