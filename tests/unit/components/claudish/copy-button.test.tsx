/**
 * @jest-environment jsdom
 *
 * Claudish translator — copy button (feat/claudish M2, phase D).
 * Copies the output, shows a transient "Copied" affordance, and fires
 * claudish_share with share_action copy_output (copy IS distribution).
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/events/track', () => ({
  trackClaudishShare: jest.fn(),
}));

import { CopyButton } from '@/components/claudish/copy-button';
import { trackClaudishShare } from '@/lib/events/track';

const mockTrack = trackClaudishShare as jest.Mock;

beforeEach(() => {
  mockTrack.mockReset();
});

/** userEvent.setup() installs its own clipboard stub; ours must land after. */
const setupWithClipboard = (writeText = jest.fn().mockResolvedValue(undefined)) => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return { user, writeText };
};

describe('CopyButton', () => {
  it('writes the output to the clipboard and fires copy_output', async () => {
    const { user, writeText } = setupWithClipboard();
    render(<CopyButton output="Le résultat traduit" direction="en2cl" />);
    await user.click(screen.getByRole('button', { name: /copy translation/i }));
    expect(writeText).toHaveBeenCalledWith('Le résultat traduit');
    expect(mockTrack).toHaveBeenCalledWith({
      share_action: 'copy_output',
      direction: 'en_to_claudish',
      output_chars: 19,
      share_truncated: false,
      share_url_chars: 0,
    });
  });

  it('shows a transient Copied confirmation', async () => {
    const { user } = setupWithClipboard();
    render(<CopyButton output="text" direction="cl2en" />);
    await user.click(screen.getByRole('button', { name: /copy translation/i }));
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it('is disabled with no output and fires nothing', async () => {
    const { user } = setupWithClipboard();
    render(<CopyButton output="" direction="en2cl" />);
    const button = screen.getByRole('button', { name: /copy translation/i });
    expect(button).toBeDisabled();
    await user.click(button).catch(() => undefined);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('does not crash when the clipboard API rejects', async () => {
    const { user } = setupWithClipboard(jest.fn().mockRejectedValue(new Error('denied')));
    render(<CopyButton output="text" direction="en2cl" />);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /copy translation/i }));
    });
    expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();
  });
});
