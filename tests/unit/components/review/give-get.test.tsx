/**
 * @jest-environment jsdom
 *
 * The "You get" checklist cuts each bold lead from the front of a signed
 * sentence (21.1). If a reword ever leaves a lead that no longer opens its
 * sentence, the page must still show the sentence whole, not a garbled cut.
 */
import { render, screen, within } from '@testing-library/react';

jest.mock('@/lib/content/review', () => {
  const actual = jest.requireActual('@/lib/content/review');
  return {
    ...actual,
    REVIEW_GET: {
      label: 'You get',
      items: [
        { lead: 'A first summary', text: 'A first summary after the kickoff.' },
        // Reworded sentence, stale lead.
        { lead: 'A recorded walkthrough', text: 'A walkthrough, recorded, with your team.' },
      ],
    },
  };
});

import { GiveGet } from '@/components/review/give-get';

describe('the "You get" checklist', () => {
  it('shows a sentence whole, with no bold, when its lead does not open it', () => {
    render(<GiveGet />);
    const heading = screen.getByRole('heading', { level: 3, name: 'You get' });
    const items = within(heading.parentElement!.querySelector('ul')!).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'A first summary after the kickoff.',
      'A walkthrough, recorded, with your team.',
    ]);
    expect(items[0].querySelector('strong')).toHaveTextContent('A first summary');
    expect(items[1].querySelector('strong')).toBeNull();
  });
});
