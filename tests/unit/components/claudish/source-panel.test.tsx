/**
 * @jest-environment jsdom
 *
 * Claudish translator — source panel (feat/claudish M2, phase D).
 * Textarea with native maxLength enforcement (pastes truncate), clear
 * button, char counter wiring, tab row with detection label.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SourcePanel } from '@/components/claudish/source-panel';
import { INPUT_CAP } from '@/lib/claudish/limits';

const noop = () => {};

describe('SourcePanel', () => {
  it('enforces the input cap via native maxLength', () => {
    render(
      <SourcePanel
        value=""
        onChange={noop}
        activeTab={0}
        onTabSelect={noop}
        detection={null}
      />
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', String(INPUT_CAP));
  });

  it('reports typed input and shows the counter', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SourcePanel
        value=""
        onChange={onChange}
        activeTab={0}
        onTabSelect={noop}
        detection={null}
      />
    );
    await user.type(screen.getByRole('textbox'), 'hi');
    expect(onChange).toHaveBeenCalled();
  });

  it('clears via the clear button', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SourcePanel
        value="some text"
        onChange={onChange}
        activeTab={0}
        onTabSelect={noop}
        detection={null}
      />
    );
    await user.click(screen.getByRole('button', { name: /clear source text/i }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('hides the clear button when empty and shows the counter', () => {
    render(
      <SourcePanel
        value=""
        onChange={noop}
        activeTab={0}
        onTabSelect={noop}
        detection={null}
      />
    );
    expect(screen.queryByRole('button', { name: /clear source text/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('claudish-char-counter')).toHaveTextContent('0 / 3,000');
  });

  it('grows with its content: a grow-wrap mirrors the value so the box never scrolls inside', () => {
    // Ian, 2026-09-03: the input box has to expand like the output box.
    // The pseudo-element replica (CSS-Tricks grow-wrap) sizes the grid
    // cell; the textarea stretches to it and hides its own scrollbar.
    const value = 'first line\nsecond line\n';
    render(
      <SourcePanel
        value={value}
        onChange={noop}
        activeTab={0}
        onTabSelect={noop}
        detection={null}
      />
    );
    const wrap = screen.getByTestId('claudish-source-grow');
    expect(wrap).toHaveAttribute('data-replicated-value', `${value} `);
    expect(wrap.className).toContain('after:content-[attr(data-replicated-value)]');
    expect(wrap.className).toContain('after:whitespace-pre-wrap');
    expect(screen.getByRole('textbox').className).toContain('overflow-hidden');
  });

  it('keeps its full border on desktop (the open right edge read as clipped)', () => {
    render(
      <SourcePanel
        value=""
        onChange={noop}
        activeTab={0}
        onTabSelect={noop}
        detection={null}
      />
    );
    const section = screen.getByRole('region', { name: /source text/i });
    expect(section.className).not.toContain('md:border-r-0');
    expect(section.className).not.toContain('md:rounded-r-none');
  });
});
