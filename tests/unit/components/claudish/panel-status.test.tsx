/**
 * @jest-environment jsdom
 *
 * Claudish translator — verbatim status lines (feat/claudish M2, phase D).
 * Refusal and capacity get the spec's exact lines; generic errors reuse
 * the capacity line by decision. role="status" for screen readers.
 */
import { render, screen } from '@testing-library/react';

import { PanelStatus } from '@/components/claudish/panel-status';
import { CAPACITY_MESSAGE, REFUSAL_MESSAGE } from '@/lib/claudish/messages';

describe('PanelStatus', () => {
  it('renders the verbatim refusal line', () => {
    render(<PanelStatus status="refused" />);
    expect(screen.getByRole('status')).toHaveTextContent(REFUSAL_MESSAGE);
  });

  it('renders the verbatim capacity line', () => {
    render(<PanelStatus status="capacity" />);
    expect(screen.getByRole('status')).toHaveTextContent(CAPACITY_MESSAGE);
  });

  it('reuses the capacity line for generic errors (decision: page never breaks)', () => {
    render(<PanelStatus status="error" />);
    expect(screen.getByRole('status')).toHaveTextContent(CAPACITY_MESSAGE);
  });

  it('renders nothing for non-terminal statuses', () => {
    const { container } = render(<PanelStatus status="streaming" />);
    expect(container).toBeEmptyDOMElement();
  });
});
