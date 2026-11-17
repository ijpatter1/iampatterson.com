/**
 * @jest-environment jsdom
 *
 * Claudish translator — source panel (feat/claudish M2, phase D).
 * Textarea with native maxLength enforcement (pastes truncate), clear
 * button, char counter wiring, tab row with detection label.
 */
import { fireEvent, render, screen } from '@testing-library/react';
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
        holdsSample={false}
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
        holdsSample={false}
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
        holdsSample={false}
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
        holdsSample={false}
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
        holdsSample={false}
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
        holdsSample={false}
      />
    );
    const section = screen.getByRole('region', { name: /source text/i });
    expect(section.className).not.toContain('md:border-r-0');
    expect(section.className).not.toContain('md:rounded-r-none');
  });

  it('keeps the focus selection through the mouseup that ends the focusing click (22.2)', () => {
    // Safari places the caret on that mouseup, which would undo the
    // selection; only that one mouseup is held back.
    render(
      <SourcePanel
        value="We ship on Friday."
        onChange={noop}
        activeTab={1}
        onTabSelect={noop}
        detection={null}
        holdsSample={true}
      />
    );
    const box = screen.getByRole('textbox');
    fireEvent.mouseDown(box); // the box is not focused yet: this click focuses it
    fireEvent.focus(box);
    expect(fireEvent.mouseUp(box)).toBe(false); // default prevented
    expect(fireEvent.mouseUp(box)).toBe(true); // a later click places the caret as usual
  });

  it('a keyboard focus never holds back a later click’s mouseup (22.2)', () => {
    // Tabbing in selects the sample, but no click caused that focus, so a
    // click afterwards must place the caret normally.
    render(
      <SourcePanel
        value="We ship on Friday."
        onChange={noop}
        activeTab={1}
        onTabSelect={noop}
        detection={null}
        holdsSample={true}
      />
    );
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    box.focus();
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, box.value.length]);
    fireEvent.mouseDown(box);
    expect(fireEvent.mouseUp(box)).toBe(true);
  });

  it('coming back to the window keeps the caret the visitor placed (22.2)', () => {
    render(
      <SourcePanel
        value="We ship on Friday."
        onChange={noop}
        activeTab={1}
        onTabSelect={noop}
        detection={null}
        holdsSample={true}
      />
    );
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    box.focus();
    const end = box.value.length;
    box.setSelectionRange(end, end); // the visitor clicks again to append
    const hasFocus = jest.spyOn(document, 'hasFocus').mockReturnValue(false);
    fireEvent.blur(box); // the window loses focus
    hasFocus.mockRestore();
    fireEvent.focus(box); // and gets it back
    expect([box.selectionStart, box.selectionEnd]).toEqual([end, end]);
  });

  it('leaves the mouseup alone for the visitor’s own text', () => {
    render(
      <SourcePanel
        value="My own words"
        onChange={noop}
        activeTab={0}
        onTabSelect={noop}
        detection={null}
        holdsSample={false}
      />
    );
    const box = screen.getByRole('textbox');
    fireEvent.focus(box);
    expect(fireEvent.mouseUp(box)).toBe(true);
  });
});
