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
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/claudish/client', () => ({
  translateEndpoint: (jest.requireActual('@/lib/claudish/client') as { translateEndpoint: (u: string) => string }).translateEndpoint, streamTranslation: jest.fn() }));
jest.mock('@/lib/events/track', () => ({
  trackClaudishTranslate: jest.fn(),
  trackClaudishDetected: jest.fn(),
  trackClaudishShare: jest.fn(),
  trackClaudishRate: jest.fn(),
  trackClaudishSamplePick: jest.fn(),
}));
jest.mock('@/hooks/useScrollToTopOnMount', () => ({
  useScrollToTopOnMount: jest.fn(),
}));

import { ClaudishApp } from '@/components/claudish/claudish-app';
import { streamTranslation } from '@/lib/claudish/client';
import { encodeShare } from '@/lib/claudish/share-codec';
import { CLAUDISH_SAMPLES } from '@/lib/claudish/samples';
import {
  trackClaudishDetected,
  trackClaudishRate,
  trackClaudishSamplePick,
  trackClaudishShare,
  trackClaudishTranslate,
} from '@/lib/events/track';
import { RATE_UP_LABEL } from '@/lib/claudish/messages';
import { useScrollToTopOnMount } from '@/hooks/useScrollToTopOnMount';

const mockStream = streamTranslation as jest.Mock;
const mockShare = trackClaudishShare as jest.Mock;
const mockDetected = trackClaudishDetected as jest.Mock;
const mockTranslate = trackClaudishTranslate as jest.Mock;
const mockRate = trackClaudishRate as jest.Mock;
const mockPick = trackClaudishSamplePick as jest.Mock;

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
    await user.clear(screen.getByRole('textbox'));
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
    await user.clear(screen.getByRole('textbox'));
    await user.paste(
      // Scores ~0.09 with the shipped model (r7d): confidently English.
      'We moved the standup to nine so the contractors can join before their shift starts.'
    );
    expect(screen.getByRole('tab', { name: 'English - detected' })).toBeInTheDocument();
    // Clearing the input resets the label to the resting state.
    await user.clear(screen.getByRole('textbox'));
    expect(screen.getByRole('tab', { name: 'Detect language' })).toBeInTheDocument();
  });

  it('claims a leaning side in the mid band instead of hedging (user decision)', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await user.clear(screen.getByRole('textbox'));
    // Soft-register Claude: the leaning tier that makes the no-hedging
    // design pay off. Under the register model (r28, loop 3) the plain
    // version of this sentence scores 0.00, by design; one contrastive
    // negation puts it in the mid band.
    await user.paste(
      // Scores ~0.67 (max of model 0.60 and heuristic 0.67) with the shipped model (r28): mid-band, claims the side.
      "That criticism lands. The report isn't just long; it buries its one actionable number under six paragraphs of context."
    );
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
    await user.clear(box);
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
    await user.clear(box);
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
      await user.clear(screen.getByRole('textbox'));
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

describe('ClaudishApp — opening example and sample phrases (21.3)', () => {
  // A visitor sees the translator working before typing anything. The
  // examples are stored real output, so showing one must cost nothing:
  // no proxy request (no spend), and no claudish_translate, because
  // nothing was translated. Fake timers let the test run well past the
  // 600ms debounce and prove no request is merely late.
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const waitPastDebounce = () =>
    act(async () => {
      jest.advanceTimersByTime(2000);
    });
  const selectedTab = (row: 'Source language' | 'Target language') =>
    within(screen.getByRole('tablist', { name: row }))
      .getAllByRole('tab')
      .findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
  const cards = () =>
    within(screen.getByRole('list', { name: 'Try one' })).getAllByRole('button');
  const pressedCards = () => cards().map((card) => card.getAttribute('aria-pressed'));
  // A focus selects a sample (22.2), so a test that edits the sample in
  // place puts the caret at the end first, as a visitor's second click does.
  const caretAtEnd = (el: HTMLElement) => {
    const end = (el as HTMLTextAreaElement).value.length;
    return { initialSelectionStart: end, initialSelectionEnd: end };
  };

  it('opens on the first sample already translated, with no request and no analytics', async () => {
    const [first] = CLAUDISH_SAMPLES;
    render(<ClaudishApp />);
    expect(screen.getByRole('textbox')).toHaveValue(first.source);
    expect(screen.getByTestId('claudish-output')).toHaveTextContent(first.target);
    expect(selectedTab('Source language')).toBe(1); // English
    expect(selectedTab('Target language')).toBe(1); // Claudish
    expect(pressedCards()).toEqual(['true', 'false', 'false']);
    await waitPastDebounce();
    expect(mockStream).not.toHaveBeenCalled();
    expect(mockTranslate).not.toHaveBeenCalled();
    expect(mockDetected).not.toHaveBeenCalled();
    expect(mockShare).not.toHaveBeenCalled();
    expect(mockPick).not.toHaveBeenCalled();
  });

  it('a share link opens on the shared translation, not the sample', () => {
    const t = shareParamFor({ direction: 'en2cl', source: 'Shared.', target: 'Shared — truly.' });
    render(<ClaudishApp shareParam={t} />);
    expect(screen.getByRole('textbox')).toHaveValue('Shared.');
    expect(pressedCards()).toEqual(['false', 'false', 'false']);
  });

  it('tapping the Claudish sample fills the box and shows its stored translation without calling the proxy', async () => {
    const user = setupUser();
    const sample = CLAUDISH_SAMPLES[2];
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    expect(screen.getByRole('textbox')).toHaveValue(sample.source);
    // The live mirror carries the finished text at once (the visible
    // panel reveals cl2en text progressively).
    expect(screen.getByTestId('claudish-live-mirror')).toHaveTextContent(sample.target);
    expect(selectedTab('Source language')).toBe(2); // Claudish
    expect(selectedTab('Target language')).toBe(0); // English
    expect(pressedCards()).toEqual(['false', 'false', 'true']);
    await waitPastDebounce();
    expect(mockStream).not.toHaveBeenCalled();
    expect(mockTranslate).not.toHaveBeenCalled();
    expect(mockDetected).not.toHaveBeenCalled();
  });

  it('an edit to a sample returns the box to Detect, which reads the edited text', async () => {
    // The approved mockup's behaviour: the visitor's text is detected
    // afresh. The Claudish sample plus a few words still reads as Claudish,
    // so Detect translates it into English.
    const user = setupUser();
    const sample = CLAUDISH_SAMPLES[2];
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    await user.type(screen.getByRole('textbox'), ' Truly.', caretAtEnd(screen.getByRole('textbox')));
    expect(pressedCards()).toEqual(['false', 'false', 'false']);
    expect(screen.getByRole('tab', { name: 'Claudish - detected' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream.mock.calls[0][1]).toEqual({
      text: `${sample.source} Truly.`,
      direction: 'cl2en',
    });
  });

  it('typing after a sample fires no claudish_detected for the sample’s own language', async () => {
    // The latch was primed with the sample; a detection event must reflect
    // text the visitor changed, not the example they were handed.
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    await user.type(screen.getByRole('textbox'), ' x', caretAtEnd(screen.getByRole('textbox')));
    expect(mockDetected).not.toHaveBeenCalled();
  });

  it('select-all and paste of Claudish over the opening sample is detected afresh as Claudish', async () => {
    // The commonest first action: replace the example with your own text.
    const user = setupUser();
    render(<ClaudishApp />);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.click(box);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste(CLAUDISH_SENTENCE);
    expect(box).toHaveValue(CLAUDISH_SENTENCE);
    expect(screen.getByRole('tab', { name: 'Claudish - detected' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(selectedTab('Target language')).toBe(0); // English
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream.mock.calls[0][1]).toEqual({ text: CLAUDISH_SENTENCE, direction: 'cl2en' });
    // The visitor's own text: this detection is theirs and is reported.
    expect(mockDetected).toHaveBeenCalledWith(
      expect.objectContaining({ detected_language: 'en-x-claudish' }),
    );
  });

  it('a tab the visitor chose survives Clear, so a short Claudish line still goes cl2en', async () => {
    // Before 21.3 behaviour: the visitor's own choice is kept. Detect could
    // not read a line under 24 characters and would send it en2cl.
    const user = setupUser();
    render(<ClaudishApp />);
    const sourceTabs = within(screen.getByRole('tablist', { name: 'Source language' }));
    await user.click(sourceTabs.getByRole('tab', { name: 'Claudish' }));
    await user.click(screen.getByRole('button', { name: 'Clear source text' }));
    expect(sourceTabs.getByRole('tab', { name: 'Claudish' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('textbox'));
    await user.paste('Not a bug — a choice.');
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream.mock.calls[0][1]).toEqual({
      text: 'Not a bug — a choice.',
      direction: 'cl2en',
    });
  });

  it('a tab the visitor chose survives an edit to a sample', async () => {
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    const sourceTabs = within(screen.getByRole('tablist', { name: 'Source language' }));
    await user.click(sourceTabs.getByRole('tab', { name: 'English' }));
    await user.click(sourceTabs.getByRole('tab', { name: 'Claudish' }));
    await user.type(screen.getByRole('textbox'), ' x', caretAtEnd(screen.getByRole('textbox')));
    expect(selectedTab('Source language')).toBe(2);
  });

  it('a tab set by a swap onto a sample is the sample’s: an edit returns to Detect', async () => {
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(cards()[1]);
    await user.click(screen.getByRole('button', { name: /swap languages/i })); // lands on sample 3
    expect(selectedTab('Source language')).toBe(2);
    await user.type(screen.getByRole('textbox'), ' x', caretAtEnd(screen.getByRole('textbox')));
    expect(selectedTab('Source language')).toBe(0);
  });

  it('a share link’s own translation beats a stored sample with the same text', async () => {
    // A share of "We ship on Friday." carries its own output: that is what
    // the page, Copy and Share must show, matching opened_shared_link.
    const target = 'Friday is the date — and the date is the promise.';
    const t = shareParamFor({ direction: 'en2cl', source: CLAUDISH_SAMPLES[0].source, target });
    render(<ClaudishApp shareParam={t} />);
    expect(screen.getByTestId('claudish-output')).toHaveTextContent(target);
    expect(screen.getByTestId('claudish-output')).not.toHaveTextContent(CLAUDISH_SAMPLES[0].target);
    expect(pressedCards()).toEqual(['false', 'false', 'false']);
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({ share_action: 'opened_shared_link', output_chars: target.length }),
    );
    await waitPastDebounce();
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('Backspace at the end of the Claudish sample fires no claudish_detected', async () => {
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    await user.type(screen.getByRole('textbox'), '{Backspace}', caretAtEnd(screen.getByRole('textbox')));
    expect(mockDetected).not.toHaveBeenCalled();
  });

  it('a mid-text typo fix in the Claudish sample fires no claudish_detected', async () => {
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    // Put the caret after "numbers" and insert a stray character.
    const at = box.value.indexOf('numbers') + 'numbers'.length;
    await user.click(box);
    box.setSelectionRange(at, at);
    await user.keyboard('s');
    expect(box.value).not.toBe(CLAUDISH_SAMPLES[2].source);
    expect(mockDetected).not.toHaveBeenCalled();
  });

  it('an append that flips the sample’s verdict is the visitor’s detection and fires', async () => {
    // Sample 2 reads as English; the visitor's Claudish addition changes
    // the verdict, so the detection is theirs. (The reverse, English
    // appended to sample 3, never flips within the 3,000 cap: the
    // heuristic still scores 0.509 at 2,879 characters.)
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(cards()[1]);
    await waitPastDebounce(); // past the latch's dwell
    await user.click(screen.getByRole('textbox'));
    await user.paste(` ${CLAUDISH_SENTENCE} It underscores a robust, seamless tapestry of meaning.`);
    expect(mockDetected).toHaveBeenCalledWith(
      expect.objectContaining({ detected_language: 'en-x-claudish' }),
    );
  });

  it('Clear, then typing text that starts with a sample’s words, is the visitor’s own and fires', async () => {
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(screen.getByRole('button', { name: 'Clear source text' }));
    await user.click(screen.getByRole('textbox'));
    await user.paste(
      'We ship on Friday. We moved the standup to nine so the contractors can join before their shift starts.',
    );
    expect(mockDetected).toHaveBeenCalledWith(expect.objectContaining({ detected_language: 'en' }));
  });

  it('a tab round trip back onto a sample shows it as that sample, with no claudish_translate', async () => {
    const user = setupUser();
    const sample = CLAUDISH_SAMPLES[2];
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    const sourceTabs = within(screen.getByRole('tablist', { name: 'Source language' }));
    await user.click(sourceTabs.getByRole('tab', { name: 'English' }));
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1); // the visitor's en2cl request
    await user.click(sourceTabs.getByRole('tab', { name: 'Claudish' }));
    expect(pressedCards()).toEqual(['false', 'false', 'true']);
    expect(screen.getByTestId('claudish-live-mirror')).toHaveTextContent(sample.target);
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('undoing an edit back to a sample’s exact text shows it as that sample again', async () => {
    const user = setupUser();
    const sample = CLAUDISH_SAMPLES[1];
    render(<ClaudishApp />);
    await user.click(cards()[1]);
    const box = screen.getByRole('textbox');
    await user.type(box, ' x', caretAtEnd(box));
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1); // the edited text went live
    await user.type(box, '{Backspace}{Backspace}', caretAtEnd(box));
    expect(box).toHaveValue(sample.source);
    expect(pressedCards()).toEqual(['false', 'true', 'false']);
    expect(screen.getByTestId('claudish-output')).toHaveTextContent(sample.target);
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('Detect after the Claudish sample claims Claudish and keeps the stored translation', async () => {
    // The tap feeds the sample's text to the detection latch (as swap does
    // with its output), so Detect names the side the detector reads
    // (this sample scores 0.85+, "Claudish - detected") and the direction
    // stays cl2en: the box still holds the stored source in the stored
    // direction, so nothing is requested and the card stays pressed. The
    // tap fires no claudish_detected: the visitor typed nothing.
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    await user.click(screen.getByRole('tab', { name: 'Detect language' }));
    expect(screen.getByRole('tab', { name: 'Claudish - detected' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(selectedTab('Target language')).toBe(0); // English: cl2en holds
    expect(pressedCards()).toEqual(['false', 'false', 'true']);
    expect(screen.getByTestId('claudish-live-mirror')).toHaveTextContent(
      CLAUDISH_SAMPLES[2].target,
    );
    await waitPastDebounce();
    expect(mockStream).not.toHaveBeenCalled();
    expect(mockTranslate).not.toHaveBeenCalled();
    expect(mockDetected).not.toHaveBeenCalled();
  });

  it('the Claudish sample on the English tab is translated live, never shown with its cl2en output', async () => {
    // Sample 3's source is sample 2's output, so the same text has a
    // stored translation in one direction only. Read the other way it
    // must go to the translator, not borrow the stored cl2en text.
    const user = setupUser();
    const sample = CLAUDISH_SAMPLES[2];
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    const sourceTabs = within(screen.getByRole('tablist', { name: 'Source language' }));
    await user.click(sourceTabs.getByRole('tab', { name: 'English' }));
    expect(pressedCards()).toEqual(['false', 'false', 'false']);
    expect(screen.getByTestId('claudish-live-mirror')).not.toHaveTextContent(sample.target);
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream.mock.calls[0][1]).toEqual({ text: sample.source, direction: 'en2cl' });
  });

  it('swap on sample 2 lands on sample 3 and shows its stored translation, with no request', async () => {
    // Intended: sample 2's output IS sample 3's source, and sample 3's
    // target is the real cl2en output for exactly that text, so the swap
    // shows it as the sample it is (card 3 pressed), at zero tokens and
    // with no claudish_translate, the same as tapping card 3.
    const user = setupUser();
    const [, second, third] = CLAUDISH_SAMPLES;
    render(<ClaudishApp />);
    await user.click(cards()[1]);
    await user.click(screen.getByRole('button', { name: /swap languages/i }));
    expect(screen.getByRole('textbox')).toHaveValue(second.target);
    expect(screen.getByRole('textbox')).toHaveValue(third.source);
    expect(screen.getByTestId('claudish-live-mirror')).toHaveTextContent(third.target);
    expect(selectedTab('Source language')).toBe(2); // Claudish
    expect(pressedCards()).toEqual(['false', 'false', 'true']);
    await waitPastDebounce();
    expect(mockStream).not.toHaveBeenCalled();
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it('swap on a sample whose output is not another sample translates live, with no card pressed', async () => {
    const user = setupUser();
    const [first] = CLAUDISH_SAMPLES;
    render(<ClaudishApp />);
    await user.click(screen.getByRole('button', { name: /swap languages/i }));
    expect(screen.getByRole('textbox')).toHaveValue(first.target);
    expect(pressedCards()).toEqual(['false', 'false', 'false']);
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream.mock.calls[0][1]).toEqual({ text: first.target, direction: 'cl2en' });
  });

  it('a tab change that keeps the direction keeps the opening sample on show', async () => {
    const user = setupUser();
    render(<ClaudishApp />);
    // "We ship on Friday." is too short to detect, so Detect stays en2cl.
    await user.click(screen.getByRole('tab', { name: 'Detect language' }));
    expect(pressedCards()).toEqual(['true', 'false', 'false']);
    await waitPastDebounce();
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('a tab change that flips the direction replaces the sample with a live translation', async () => {
    const user = setupUser();
    render(<ClaudishApp />);
    const sourceTabs = within(screen.getByRole('tablist', { name: 'Source language' }));
    await user.click(sourceTabs.getByRole('tab', { name: 'Claudish' }));
    expect(pressedCards()).toEqual(['false', 'false', 'false']);
    await waitPastDebounce();
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream.mock.calls[0][1]).toEqual({
      text: CLAUDISH_SAMPLES[0].source,
      direction: 'cl2en',
    });
  });

  it('a share link that fails to decode opens the translator empty, with no sample claimed', async () => {
    render(<ClaudishApp shareParam="!!not-a-share!!" />);
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByTestId('claudish-output')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Detect language' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(pressedCards()).toEqual(['false', 'false', 'false']);
    await waitPastDebounce();
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('clearing a sample leaves an empty box on the Detect tab', async () => {
    const user = setupUser();
    render(<ClaudishApp />);
    await user.click(screen.getByRole('button', { name: 'Clear source text' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('tab', { name: 'Detect language' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(pressedCards()).toEqual(['false', 'false', 'false']);
  });
});

describe('ClaudishApp — the samples are measured (22.1)', () => {
  // Without these, nobody can tell whether visitors use the cards, and a
  // rating of the opening example reads as a rating of the model.
  const cards = () =>
    within(screen.getByRole('list', { name: 'Try one' })).getAllByRole('button');
  const rate = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /rate translation/i }));
    await user.click(screen.getByRole('button', { name: RATE_UP_LABEL }));
  };

  it('a card tap pushes claudish_sample_pick with its number and direction', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    expect(mockPick).toHaveBeenCalledTimes(1);
    expect(mockPick).toHaveBeenCalledWith({ sample_index: 3, direction: 'claudish_to_en' });
  });

  it('a tap on the card already showing pushes nothing', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await user.click(cards()[0]); // the opening example's own card
    expect(mockPick).not.toHaveBeenCalled();
  });

  it('a swap that lands on a sample is not a tap and pushes nothing', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await user.click(cards()[1]);
    mockPick.mockClear();
    await user.click(screen.getByRole('button', { name: /swap languages/i }));
    expect(mockPick).not.toHaveBeenCalled();
  });

  it('rating the opening example sends from_sample true', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await rate(user);
    expect(mockRate).toHaveBeenCalledWith(expect.objectContaining({ from_sample: true }));
  });

  it('rating a shared (live) translation sends from_sample false', async () => {
    const user = userEvent.setup();
    const t = shareParamFor({ direction: 'en2cl', source: 'Plain.', target: 'Plain — ornate.' });
    render(<ClaudishApp shareParam={t} />);
    await rate(user);
    expect(mockRate).toHaveBeenCalledWith(expect.objectContaining({ from_sample: false }));
  });
});

describe('ClaudishApp — typing replaces a sample (22.2)', () => {
  // Before 22.2 a visitor who clicked into the opening example and typed
  // got "We ship on Friday.Hello", and a model call spent on mixed text.
  const cards = () =>
    within(screen.getByRole('list', { name: 'Try one' })).getAllByRole('button');
  const selection = (box: HTMLTextAreaElement) => [box.selectionStart, box.selectionEnd];

  it('clicking into the opening example selects it, so the first keystroke replaces it', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.click(box);
    expect(selection(box)).toEqual([0, CLAUDISH_SAMPLES[0].source.length]);
    await user.keyboard('Hello');
    expect(box).toHaveValue('Hello');
  });

  it('a tapped sample is selected when the box takes focus', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    await user.click(cards()[2]);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.click(box);
    expect(selection(box)).toEqual([0, CLAUDISH_SAMPLES[2].source.length]);
  });

  it('the visitor’s own text is never selected on focus', async () => {
    const user = userEvent.setup();
    render(<ClaudishApp />);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.clear(box);
    await user.type(box, 'My own words');
    await user.tab();
    await user.click(box);
    const [start, end] = selection(box);
    expect(start).toBe(end);
    expect(box).toHaveValue('My own words');
  });
});

