/**
 * @jest-environment jsdom
 *
 * Claudish translator — target panel (feat/claudish M2, phase D).
 * Streams live text (lang=en-x-claudish when translating into Claudish),
 * dims stale output until the first new token, cycles spinner verbs
 * while waiting, renders verbatim status lines, aria-busy during
 * streaming with the final text mirrored once for screen readers.
 */
import { act, render, screen } from '@testing-library/react';

jest.mock('@/lib/events/track', () => ({
  trackClaudishShare: jest.fn(),
  trackClaudishRate: jest.fn(),
}));
jest.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

import { TargetPanel } from '@/components/claudish/target-panel';
import { CAPACITY_MESSAGE, CLAUDISH_LANG_TAG } from '@/lib/claudish/messages';

const base = {
  source: 'input text',
  direction: 'en2cl' as const,
  activeTab: 1,
  onTabSelect: () => {},
  staleText: '',
  hasFirstToken: false,
  ttftMs: null,
  cache: 'miss' as const,
};

describe('TargetPanel', () => {
  it('renders streamed text with the Claudish language tag and aria-busy', () => {
    render(
      <TargetPanel {...base} status="streaming" text="Bonjour —" hasFirstToken={true} />
    );
    const output = screen.getByTestId('claudish-output');
    expect(output).toHaveTextContent('Bonjour —');
    expect(output).toHaveAttribute('lang', CLAUDISH_LANG_TAG);
    expect(output).toHaveAttribute('aria-busy', 'true');
  });

  it('uses plain en for the English direction', () => {
    render(
      <TargetPanel
        {...base}
        direction="cl2en"
        status="done"
        text="Plain English."
        hasFirstToken={true}
      />
    );
    expect(screen.getByTestId('claudish-output')).toHaveAttribute('lang', 'en');
  });

  it('dims stale output and shows spinner verbs before the first token', () => {
    render(
      <TargetPanel {...base} status="streaming" text="" staleText="Old translation" />
    );
    expect(screen.getByTestId('claudish-stale')).toHaveTextContent('Old translation');
    expect(screen.getByTestId('claudish-spinner')).toBeInTheDocument();
  });

  it('renders the verbatim status line on capacity', () => {
    render(<TargetPanel {...base} status="capacity" text="" />);
    expect(screen.getByRole('status')).toHaveTextContent(CAPACITY_MESSAGE);
  });

  it('shows the Translation placeholder at idle', () => {
    render(<TargetPanel {...base} status="idle" text="" />);
    expect(screen.getByText('Translation')).toBeInTheDocument();
  });

  it('mirrors the finished text once into a polite live region', () => {
    render(
      <TargetPanel {...base} status="done" text="Final output." hasFirstToken={true} />
    );
    const mirror = screen.getByTestId('claudish-live-mirror');
    expect(mirror).toHaveAttribute('aria-live', 'polite');
    expect(mirror).toHaveTextContent('Final output.');
  });
});

describe('concealed refinement (Ian UX decision, 2026-09-01)', () => {
  it('cl2en streaming shows the translating animation, never draft text', () => {
    render(
      <TargetPanel
        {...base}
        direction="cl2en"
        status="streaming"
        text="This draft must never render mid-flight."
        hasFirstToken={true}
      />
    );
    expect(screen.queryByTestId('claudish-output')).toBeNull();
    expect(screen.getByTestId('claudish-spinner')).toBeInTheDocument();
  });

  it('en2cl still streams live (no concealment)', () => {
    render(
      <TargetPanel
        {...base}
        direction="en2cl"
        status="streaming"
        text="Streaming Claudish — visible as it lands."
        hasFirstToken={true}
      />
    );
    expect(screen.getByTestId('claudish-output')).toHaveTextContent('visible as it lands');
  });

  it('cl2en reveals progressively at done', () => {
    jest.useFakeTimers();
    const LONG = 'Sentence one is here. '.repeat(20).trim();
    render(
      <TargetPanel {...base} direction="cl2en" status="done" text={LONG} hasFirstToken={true} />
    );
    const first = screen.getByTestId('claudish-output').textContent ?? '';
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(LONG.length);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('claudish-output')).toHaveTextContent('Sentence one is here.');
    expect((screen.getByTestId('claudish-output').textContent ?? '').length).toBe(LONG.length);
    jest.useRealTimers();
  });
});
