/**
 * @jest-environment jsdom
 *
 * Claudish translator — app orchestrator (feat/claudish M2, phase E1).
 *
 * Wiring under test: share-link rehydration seeds both panels with ZERO
 * proxy calls and fires opened_shared_link exactly once; typing runs the
 * detection latch in the change handler (no effect-driven detection) and
 * fires claudish_detected once per session per language; the swap
 * arrows move output→input, flip direction, and fire an immediate
 * manual translation; scroll-to-top applies on mount.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/claudish/client', () => ({ streamTranslation: jest.fn() }));
jest.mock('@/lib/events/track', () => ({
  trackClaudishTranslate: jest.fn(),
  trackClaudishDetected: jest.fn(),
  trackClaudishShare: jest.fn(),
  trackClaudishRate: jest.fn(),
}));
jest.mock('@/hooks/useScrollToTopOnMount', () => ({
  useScrollToTopOnMount: jest.fn(),
}));

import { ClaudishApp } from '@/components/claudish/claudish-app';
import { streamTranslation } from '@/lib/claudish/client';
import { encodeShare } from '@/lib/claudish/share-codec';
import { trackClaudishDetected, trackClaudishShare } from '@/lib/events/track';
import { useScrollToTopOnMount } from '@/hooks/useScrollToTopOnMount';

const mockStream = streamTranslation as jest.Mock;
const mockShare = trackClaudishShare as jest.Mock;
const mockDetected = trackClaudishDetected as jest.Mock;

const CLAUDISH_SENTENCE =
  "This isn't just a refactor — it's a fundamental shift in how the pipeline thinks about state.";

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  // The hook reads this at call time in Jest (no Next inlining here); with
  // it set, the rehydration zero-call assertion is real, not vacuous.
  process.env.NEXT_PUBLIC_CLAUDISH_PROXY_URL = 'https://proxy.test/translate';
  mockStream.mockImplementation(
    (_url, _req, signal: AbortSignal) =>
      new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve({ kind: 'aborted' }));
      })
  );
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CLAUDISH_PROXY_URL;
});

const shareParamFor = (payload: {
  direction: 'en2cl' | 'cl2en';
  source: string;
  target: string;
}) => {
  const { url } = encodeShare(payload, { baseUrl: '/claudish' });
  return new URL(url, 'https://x.test').searchParams.get('t') as string;
};

describe('ClaudishApp', () => {
  it('renders panels, footer, and applies scroll-to-top on mount', () => {
    render(<ClaudishApp />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(useScrollToTopOnMount).toHaveBeenCalled();
  });

  it('strips ?t= from the address bar on mount (belt-and-braces twin of the layout script)', () => {
    const t = shareParamFor({ direction: 'en2cl', source: 'Seed.', target: 'Seeded — output.' });
    window.history.replaceState(null, '', `/claudish?t=${encodeURIComponent(t)}`);
    const spy = jest.spyOn(window.history, 'replaceState');
    render(<ClaudishApp shareParam={t} />);
    expect(spy).toHaveBeenCalled();
    const lastUrl = String(spy.mock.calls[spy.mock.calls.length - 1][2]);
    expect(lastUrl).not.toContain('t=');
    spy.mockRestore();
    window.history.replaceState(null, '', '/');
  });

  it('rehydrates a share link with zero proxy calls and one opened_shared_link', () => {
    const t = shareParamFor({
      direction: 'en2cl',
      source: 'We ship Friday.',
      target: "We don't just ship Friday — we commit to it.",
    });
    render(<ClaudishApp shareParam={t} />);
    expect(screen.getByRole('textbox')).toHaveValue('We ship Friday.');
    expect(screen.getByTestId('claudish-output')).toHaveTextContent(
      "We don't just ship Friday — we commit to it."
    );
    expect(mockStream).not.toHaveBeenCalled();
    const opens = mockShare.mock.calls.filter(
      (c) => c[0].share_action === 'opened_shared_link'
    );
    expect(opens).toHaveLength(1);
  });

  it('shows "Claudish - detected" and flips the target to English while latched', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await user.click(screen.getByRole('textbox'));
    await user.paste(CLAUDISH_SENTENCE);
    expect(
      screen.getByRole('tab', { name: 'Claudish - detected' })
    ).toBeInTheDocument();
    // Detected Claudish source ⇒ the target row's English tab is active.
    const englishTarget = screen
      .getAllByRole('tab', { name: 'English' })
      .find((tab) => tab.closest('[aria-label="Target language"]'));
    expect(englishTarget).toHaveAttribute('aria-selected', 'true');
  });

  it('labels confident plain English as "English - detected" (GT names its guess)', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await user.click(screen.getByRole('textbox'));
    await user.paste(
      // Scores ~0.25 with the trained model: confidently English.
      'Saw a tweet this week about Anthropic, one of the hottest companies on earth, saying their biggest problem is still hiring. Not enough exceptional people who can generate good judgment under extreme ambiguity is how they put it.'
    );
    expect(screen.getByRole('tab', { name: 'English - detected' })).toBeInTheDocument();
    // Clearing the input resets the label to the resting state.
    await user.clear(screen.getByRole('textbox'));
    expect(screen.getByRole('tab', { name: 'Detect language' })).toBeInTheDocument();
  });

  it('claims a leaning side in the mid band instead of hedging (user decision)', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await user.click(screen.getByRole('textbox'));
    // Terse imperative prose: CCLD scores this ~0.72 — sub-latch Claudish.
    await user.paste('The meeting moved to Thursday. Bring the numbers.');
    expect(screen.getByRole('tab', { name: 'Leaning Claudish' })).toBeInTheDocument();
    // A claimed Claudish side drives the direction: target flips to English.
    const englishTarget = screen
      .getAllByRole('tab', { name: 'English' })
      .find((tab) => tab.closest('[aria-label="Target language"]'));
    expect(englishTarget).toHaveAttribute('aria-selected', 'true');
  });

  it('fires claudish_detected once per session per language', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    const box = screen.getByRole('textbox');
    await user.click(box);
    await user.paste(CLAUDISH_SENTENCE);
    const claudishFires = () =>
      mockDetected.mock.calls.filter((c) => c[0].detected_language === 'en-x-claudish');
    expect(claudishFires()).toHaveLength(1);
    await user.clear(box);
    await user.paste(CLAUDISH_SENTENCE + ' It underscores the robust design.');
    expect(claudishFires()).toHaveLength(1); // sessionStorage gate holds
  });

  it('clears the latch when the textarea is emptied (no stale Claudish direction)', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    const box = screen.getByRole('textbox');
    await user.click(box);
    await user.paste(CLAUDISH_SENTENCE);
    expect(screen.getByRole('tab', { name: 'Claudish - detected' })).toBeInTheDocument();
    await user.clear(box);
    // Short fresh English typed after the clear must not inherit cl2en.
    await user.paste('ok');
    expect(screen.queryByRole('tab', { name: 'Claudish - detected' })).not.toBeInTheDocument();
    const claudishTarget = screen
      .getAllByRole('tab', { name: 'Claudish' })
      .find((tab) => tab.closest('[aria-label="Target language"]'));
    expect(claudishTarget).toHaveAttribute('aria-selected', 'true'); // direction en2cl again
  });

  it('fires claudish_detected at most once per mount when sessionStorage throws', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      const user = userEvent.setup();
      render(<ClaudishApp />);
      await user.click(screen.getByRole('textbox'));
      await user.paste(CLAUDISH_SENTENCE);
      await user.paste(' and it underscores a robust, seamless tapestry of meaning.');
      const claudishFires = mockDetected.mock.calls.filter(
        (c) => c[0].detected_language === 'en-x-claudish'
      );
      expect(claudishFires.length).toBeLessThanOrEqual(1);
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });

  it('a share link with an empty target seeds the input but never a blank done panel', () => {
    const t = shareParamFor({ direction: 'en2cl', source: 'Only the source survived.', target: '' });
    render(<ClaudishApp shareParam={t} />);
    expect(screen.getByRole('textbox')).toHaveValue('Only the source survived.');
    expect(screen.queryByTestId('claudish-output')).not.toBeInTheDocument();
  });

  it('swap moves output to input, flips direction, and fires a manual translation', async () => {
    const user = userEvent.setup();
    const t = shareParamFor({
      direction: 'en2cl',
      source: 'Plain words.',
      target: 'Ornate — words; not plain.',
    });
    render(<ClaudishApp shareParam={t} />);
    await user.click(screen.getByRole('button', { name: /swap languages/i }));
    expect(screen.getByRole('textbox')).toHaveValue('Ornate — words; not plain.');
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream.mock.calls[0][1]).toEqual({
      text: 'Ornate — words; not plain.',
      direction: 'cl2en',
    });
  });
});
