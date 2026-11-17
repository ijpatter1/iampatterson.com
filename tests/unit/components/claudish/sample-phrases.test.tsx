/**
 * @jest-environment jsdom
 *
 * Claudish translator — the "Try one" sample cards (21.3).
 *
 * The cards are how a visitor sees the joke land before typing: each
 * names its direction and shows the phrase it will put in the box. The
 * card that matches what the panels show is marked pressed, so the
 * visitor can tell the page is showing an example, not their own text.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SamplePhrases } from '@/components/claudish/sample-phrases';
import { CLAUDISH_SAMPLES } from '@/lib/claudish/samples';

describe('SamplePhrases', () => {
  it('lists every sample under the "Try one" heading with its direction label', () => {
    render(<SamplePhrases samples={CLAUDISH_SAMPLES} activeIndex={null} onPick={() => {}} />);
    const list = screen.getByRole('list', { name: 'Try one' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent('English → Claudish');
    expect(buttons[0]).toHaveTextContent('We ship on Friday.');
    expect(buttons[2]).toHaveTextContent('Claudish → English');
    expect(buttons[2]).toHaveTextContent(CLAUDISH_SAMPLES[2].source);
  });

  it('marks only the sample on show as pressed', () => {
    const { rerender } = render(
      <SamplePhrases samples={CLAUDISH_SAMPLES} activeIndex={1} onPick={() => {}} />,
    );
    const pressed = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-pressed'));
    expect(pressed()).toEqual(['false', 'true', 'false']);
    rerender(<SamplePhrases samples={CLAUDISH_SAMPLES} activeIndex={null} onPick={() => {}} />);
    expect(pressed()).toEqual(['false', 'false', 'false']);
  });

  it('reports the tapped sample by index', async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    render(<SamplePhrases samples={CLAUDISH_SAMPLES} activeIndex={0} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: /Neither expressed/ }));
    expect(onPick).toHaveBeenCalledWith(2);
  });
});
