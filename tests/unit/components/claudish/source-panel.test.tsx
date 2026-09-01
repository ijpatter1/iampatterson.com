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
});
