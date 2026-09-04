/**
 * @jest-environment jsdom
 *
 * Claudish translator — share button (feat/claudish M2, phase D).
 * Builds the ?t= share URL via the codec, prefers the Web Share sheet
 * when present (web_share), falls back to copying the link (copy_link),
 * surfaces the excerpt note when the budget truncated, and never logs
 * the URL — only its length.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/events/track', () => ({
  trackClaudishShare: jest.fn(),
}));

import { ShareButton } from '@/components/claudish/share-button';
import { decodeShare } from '@/lib/claudish/share-codec';
import { trackClaudishShare } from '@/lib/events/track';

const mockTrack = trackClaudishShare as jest.Mock;

const setupClipboard = () => {
  const user = userEvent.setup();
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return { user, writeText };
};

beforeEach(() => {
  mockTrack.mockReset();
  // jsdom has no navigator.share by default; individual tests add it.
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe('ShareButton', () => {
  it('copies a decodable share link and fires copy_link with the length only', async () => {
    const { user, writeText } = setupClipboard();
    render(
      <ShareButton source="Plain input." target="Ornate — output." direction="en2cl" />
    );
    await user.click(screen.getByRole('button', { name: /share translation/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const url: string = writeText.mock.calls[0][0];
    const t = new URL(url, 'https://iampatterson.com').searchParams.get('t');
    expect(decodeShare(t as string)).toEqual({
      direction: 'en2cl',
      source: 'Plain input.',
      target: 'Ornate — output.',
      excerpt: false,
    });
    expect(mockTrack).toHaveBeenCalledWith({
      share_action: 'copy_link',
      direction: 'en_to_claudish',
      output_chars: 'Ornate — output.'.length,
      share_truncated: false,
      share_url_chars: url.length,
    });
  });

  it('prefers the Web Share sheet when the browser offers one', async () => {
    const { user } = setupClipboard();
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });
    render(<ShareButton source="src text" target="out text" direction="cl2en" />);
    await user.click(screen.getByRole('button', { name: /share translation/i }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ share_action: 'web_share', direction: 'claudish_to_en' })
    );
  });

  it('is disabled with no output', () => {
    render(<ShareButton source="text" target="" direction="en2cl" />);
    expect(screen.getByRole('button', { name: /share translation/i })).toBeDisabled();
  });
});
