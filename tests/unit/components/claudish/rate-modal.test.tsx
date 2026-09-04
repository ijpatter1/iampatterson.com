/**
 * @jest-environment jsdom
 *
 * Claudish translator — rate modal (feat/claudish M2, phase D).
 * The rate button opens an in-place mini modal with two thumbs labeled
 * verbatim "Holds up." / "You're absolutely right." — picking one fires
 * claudish_rate and closes; Esc closes without firing.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/events/track', () => ({
  trackClaudishRate: jest.fn(),
}));

import { RateModal } from '@/components/claudish/rate-modal';
import { RATE_DOWN_LABEL, RATE_UP_LABEL } from '@/lib/claudish/messages';
import { trackClaudishRate } from '@/lib/events/track';

const mockTrack = trackClaudishRate as jest.Mock;

beforeEach(() => mockTrack.mockReset());

describe('RateModal', () => {
  it('opens on the rate button and shows both verbatim thumb labels', async () => {
    const user = userEvent.setup();
    render(<RateModal output="translated text" direction="en2cl" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /rate translation/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: RATE_UP_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: RATE_DOWN_LABEL })).toBeInTheDocument();
  });

  it('fires holds_up and closes on the up thumb', async () => {
    const user = userEvent.setup();
    render(<RateModal output="translated text" direction="en2cl" />);
    await user.click(screen.getByRole('button', { name: /rate translation/i }));
    await user.click(screen.getByRole('button', { name: RATE_UP_LABEL }));
    expect(mockTrack).toHaveBeenCalledWith({
      rating: 'holds_up',
      direction: 'en_to_claudish',
      output_chars: 15,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fires absolutely_right for the down thumb', async () => {
    const user = userEvent.setup();
    render(<RateModal output="xy" direction="cl2en" />);
    await user.click(screen.getByRole('button', { name: /rate translation/i }));
    await user.click(screen.getByRole('button', { name: RATE_DOWN_LABEL }));
    expect(mockTrack).toHaveBeenCalledWith({
      rating: 'absolutely_right',
      direction: 'claudish_to_en',
      output_chars: 2,
    });
  });

  it('closes on Escape without firing', async () => {
    const user = userEvent.setup();
    render(<RateModal output="text" direction="en2cl" />);
    await user.click(screen.getByRole('button', { name: /rate translation/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('is disabled with no output', () => {
    render(<RateModal output="" direction="en2cl" />);
    expect(screen.getByRole('button', { name: /rate translation/i })).toBeDisabled();
  });
});
